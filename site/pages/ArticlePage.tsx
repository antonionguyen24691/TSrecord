import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { AdSlot } from '../components/AdSlot';
import { SiteLayout } from '../components/SiteLayout';
import { SiteArticle } from '../content/articles';
import { getSiteUrl, SiteSeo } from '../seo/SiteSeo';

export const ArticlePage = ({ article }: { article: SiteArticle }) => {
  const siteUrl = getSiteUrl();
  const path = `/tin-tuc/${article.slug}`;

  return (
    <SiteLayout>
      <SiteSeo
        title={`${article.title} | TSrecord`}
        description={article.description}
        path={path}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.description,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          mainEntityOfPage: `${siteUrl}${path}`,
          author: {
            '@type': 'Organization',
            name: 'TSrecord',
          },
          publisher: {
            '@type': 'Organization',
            name: 'TSrecord',
            logo: {
              '@type': 'ImageObject',
              url: `${siteUrl}/logo.svg`,
            },
          },
        }}
      />
      <article className="article-page">
        <header className="article-page__header">
          <div className="site-container article-page__header-inner">
            <a href="/tin-tuc" className="back-link"><ArrowLeft /> Tất cả bài viết</a>
            <span className="site-kicker">{article.category}</span>
            <h1>{article.title}</h1>
            <p>{article.description}</p>
            <div className="article-page__meta">
              <span><CalendarDays /> Cập nhật {new Date(article.updatedAt).toLocaleDateString('vi-VN')}</span>
              <span><Clock3 /> {article.readingMinutes} phút đọc</span>
            </div>
          </div>
        </header>

        <div className="site-container article-page__layout">
          <div className="article-page__content">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul>
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
              </section>
            ))}
            <div className="article-page__cta">
              <strong>Áp dụng với bản ghi của bạn</strong>
              <p>Trải nghiệm quy trình phiên âm, chỉnh sửa và lưu kết quả trong TSrecord.</p>
              <a href="/app">Mở ứng dụng <ArrowRight /></a>
            </div>
          </div>
          <aside className="content-rail">
            <AdSlot format="rectangle" />
            <nav className="rail-note" aria-label="Nội dung bài viết">
              <strong>Trong bài viết</strong>
              {article.sections.map((section) => <span key={section.heading}>{section.heading}</span>)}
            </nav>
          </aside>
        </div>
      </article>
    </SiteLayout>
  );
};
