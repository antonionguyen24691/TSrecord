import type { ArticleSection, SiteArticle } from './articles';

export type CmsPage = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  content: ArticleSection[];
  metadata: Record<string, unknown>;
  updatedAt: string;
};

const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
const cmsUrl = `${backendUrl}/api/cms`;

const requestJson = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`${cmsUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`CMS request failed with ${response.status}`);
    }
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
};

type CmsArticleResponse = {
  slug: string;
  title: string;
  description: string;
  category: string;
  content: ArticleSection[];
  featured: boolean;
  reading_minutes: number;
  published_at: string;
  updated_at: string;
};

const normalizeArticle = (article: CmsArticleResponse): SiteArticle => ({
  slug: article.slug,
  title: article.title,
  description: article.description,
  category: article.category,
  sections: Array.isArray(article.content) ? article.content : [],
  featured: article.featured,
  readingMinutes: article.reading_minutes,
  publishedAt: article.published_at,
  updatedAt: article.updated_at,
});

export const fetchCmsArticles = async () =>
  (await requestJson<CmsArticleResponse[]>('/articles')).map(normalizeArticle);

export const fetchCmsArticle = async (slug: string) =>
  normalizeArticle(await requestJson<CmsArticleResponse>(`/articles/${encodeURIComponent(slug)}`));

export const fetchCmsPage = async (slug: string): Promise<CmsPage> => {
  const page = await requestJson<{
    slug: string;
    title: string;
    description: string;
    eyebrow: string;
    content: ArticleSection[];
    metadata: Record<string, unknown>;
    updated_at: string;
  }>(`/pages/${encodeURIComponent(slug)}`);
  return {
    ...page,
    content: Array.isArray(page.content) ? page.content : [],
    metadata: page.metadata || {},
    updatedAt: page.updated_at,
  };
};
