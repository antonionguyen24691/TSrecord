import { ArrowRight, AudioLines } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdSlot } from '../components/AdSlot';
import { SiteLayout } from '../components/SiteLayout';
import { articles } from '../content/articles';
import { fetchCmsArticles } from '../content/cms';
import { SiteSeo } from '../seo/SiteSeo';

export const ArticlesPage = () => {
  const [publishedArticles, setPublishedArticles] = useState(articles);

  useEffect(() => {
    fetchCmsArticles()
      .then((items) => {
        if (items.length > 0) setPublishedArticles(items);
      })
      .catch(() => undefined);
  }, []);

  return (
    <SiteLayout>
    <SiteSeo
      title="Bài viết về phiên âm, ghi âm và năng suất | TSrecord"
      description="Hướng dẫn chuyển ghi âm thành văn bản, ghi chép cuộc họp, bảo mật dữ liệu và tổ chức nội dung."
      path="/tin-tuc"
    />
    <section className="page-hero page-hero--editorial">
      <div className="site-container">
        <span className="site-kicker">Thư viện TSrecord</span>
        <h1>Kiến thức để làm việc tốt hơn với âm thanh và văn bản.</h1>
        <p>
          Bài viết được biên soạn theo các tình huống sử dụng thực tế, có ngày cập nhật và
          đường dẫn riêng để dễ tìm kiếm, chia sẻ.
        </p>
      </div>
    </section>
    <section className="site-section site-section--editorial">
      <div className="site-container content-with-rail">
        <div className="article-list">
          {publishedArticles.map((article, index) => (
            <article key={article.slug} className="article-list-item">
              <div className="article-list-item__index">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <AudioLines />
              </div>
              <div>
                <span className="article-list-item__meta">
                  {article.category} · {article.readingMinutes} phút đọc ·{' '}
                  {new Date(article.updatedAt).toLocaleDateString('vi-VN')}
                </span>
                <h2><a href={`/tin-tuc/${article.slug}`}>{article.title}</a></h2>
                <p>{article.description}</p>
                <a className="article-link" href={`/tin-tuc/${article.slug}`}>
                  Đọc bài viết <ArrowRight />
                </a>
              </div>
            </article>
          ))}
        </div>
        <div className="content-rail">
          <AdSlot format="rectangle" />
          <aside className="rail-note">
            <strong>Bạn đang có một tệp cần xử lý?</strong>
            <p>Mở ứng dụng để phiên âm và lưu kết quả theo dự án.</p>
            <a href="/app">Mở TSrecord <ArrowRight /></a>
          </aside>
        </div>
      </div>
    </section>
    </SiteLayout>
  );
};
