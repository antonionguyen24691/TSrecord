import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAdmin } from '../auth.js';
import { ensureCmsDefaults } from '../platform/cmsDefaults.js';
import { one, query } from '../platform/database.js';
import { ensurePlatformSchema } from '../platform/schema.js';

const router = Router();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const asyncRoute = (
  handler: (req: Request, res: Response) => Promise<void>
) => (req: Request, res: Response) => {
  handler(req, res).catch((error: unknown) => {
    console.error('[CMS API]', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Không thể xử lý yêu cầu CMS.',
      });
    }
  });
};

router.use((_req: Request, res: Response, next: NextFunction) => {
  ensurePlatformSchema()
    .then(ensureCmsDefaults)
    .then(() => next())
    .catch((error: unknown) => {
      console.error('[CMS schema]', error);
      res.status(503).json({
        error: error instanceof Error ? error.message : 'CMS database chưa sẵn sàng.',
      });
    });
});

router.get('/pages/:slug', asyncRoute(async (req, res) => {
  const page = await one(
    `SELECT slug, title, description, eyebrow, content, metadata, updated_at
     FROM cms_pages_v2
     WHERE slug = $1 AND status = 'published'`,
    [req.params.slug]
  );
  if (!page) {
    res.status(404).json({ error: 'Trang không tồn tại.' });
    return;
  }
  res.json(page);
}));

router.get('/articles', asyncRoute(async (req, res) => {
  const featuredOnly = req.query.featured === 'true';
  const articles = await query(
    `SELECT id, slug, title, description, category, content, cover, featured,
            reading_minutes, published_at, updated_at
     FROM cms_articles_v2
     WHERE status = 'published' ${featuredOnly ? 'AND featured = true' : ''}
     ORDER BY featured DESC, published_at DESC NULLS LAST, updated_at DESC`
  );
  res.json(articles);
}));

router.get('/articles/:slug', asyncRoute(async (req, res) => {
  const article = await one(
    `SELECT id, slug, title, description, category, content, cover, featured,
            reading_minutes, published_at, updated_at
     FROM cms_articles_v2
     WHERE slug = $1 AND status = 'published'`,
    [req.params.slug]
  );
  if (!article) {
    res.status(404).json({ error: 'Bài viết không tồn tại.' });
    return;
  }
  res.json(article);
}));

router.use('/admin', requireAdmin);

router.get('/admin/content', asyncRoute(async (_req, res) => {
  const [pages, articles] = await Promise.all([
    query('SELECT * FROM cms_pages_v2 ORDER BY slug'),
    query('SELECT * FROM cms_articles_v2 ORDER BY updated_at DESC'),
  ]);
  res.json({ pages, articles });
}));

router.put('/admin/pages/:slug', asyncRoute(async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const { title, description, eyebrow, content, metadata, status } = req.body;
  if (!slugPattern.test(slug) || !title || !Array.isArray(content)) {
    res.status(400).json({ error: 'Slug, tiêu đề hoặc nội dung trang không hợp lệ.' });
    return;
  }
  const page = await one(
    `INSERT INTO cms_pages_v2
       (slug, title, description, eyebrow, content, metadata, status, published_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7,
             CASE WHEN $7 = 'published' THEN now() ELSE NULL END)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       eyebrow = EXCLUDED.eyebrow,
       content = EXCLUDED.content,
       metadata = EXCLUDED.metadata,
       status = EXCLUDED.status,
       published_at = CASE
         WHEN EXCLUDED.status = 'published'
           THEN COALESCE(cms_pages_v2.published_at, now())
         ELSE cms_pages_v2.published_at
       END,
       updated_at = now()
     RETURNING *`,
    [
      slug,
      String(title).trim(),
      String(description || '').trim(),
      String(eyebrow || 'TSrecord').trim(),
      JSON.stringify(content),
      JSON.stringify(metadata || {}),
      status === 'draft' ? 'draft' : 'published',
    ]
  );
  res.json(page);
}));

router.post('/admin/articles', asyncRoute(async (req, res) => {
  const {
    slug, title, description, category, content, cover,
    status, featured, readingMinutes, publishedAt,
  } = req.body;
  if (!slugPattern.test(String(slug || '')) || !title || !Array.isArray(content)) {
    res.status(400).json({ error: 'Slug, tiêu đề hoặc nội dung bài viết không hợp lệ.' });
    return;
  }
  const article = await one(
    `INSERT INTO cms_articles_v2
       (slug, title, description, category, content, cover, status, featured,
        reading_minutes, published_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9,
             COALESCE($10::timestamptz, CASE WHEN $7 = 'published' THEN now() ELSE NULL END))
     RETURNING *`,
    [
      slug,
      String(title).trim(),
      String(description || '').trim(),
      String(category || 'Kiến thức').trim(),
      JSON.stringify(content),
      JSON.stringify(cover || {}),
      status === 'published' ? 'published' : 'draft',
      Boolean(featured),
      Math.max(1, Number(readingMinutes) || 5),
      publishedAt || null,
    ]
  );
  res.status(201).json(article);
}));

router.put('/admin/articles/:id', asyncRoute(async (req, res) => {
  const {
    slug, title, description, category, content, cover,
    status, featured, readingMinutes, publishedAt,
  } = req.body;
  if (!slugPattern.test(String(slug || '')) || !title || !Array.isArray(content)) {
    res.status(400).json({ error: 'Slug, tiêu đề hoặc nội dung bài viết không hợp lệ.' });
    return;
  }
  const article = await one(
    `UPDATE cms_articles_v2 SET
       slug = $2,
       title = $3,
       description = $4,
       category = $5,
       content = $6::jsonb,
       cover = $7::jsonb,
       status = $8,
       featured = $9,
       reading_minutes = $10,
       published_at = COALESCE(
         $11::timestamptz,
         CASE WHEN $8 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
       ),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      slug,
      String(title).trim(),
      String(description || '').trim(),
      String(category || 'Kiến thức').trim(),
      JSON.stringify(content),
      JSON.stringify(cover || {}),
      status === 'published' ? 'published' : 'draft',
      Boolean(featured),
      Math.max(1, Number(readingMinutes) || 5),
      publishedAt || null,
    ]
  );
  if (!article) {
    res.status(404).json({ error: 'Bài viết không tồn tại.' });
    return;
  }
  res.json(article);
}));

router.delete('/admin/articles/:id', asyncRoute(async (req, res) => {
  await query('DELETE FROM cms_articles_v2 WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

export default router;
