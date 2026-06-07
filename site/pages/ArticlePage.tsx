import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdSlot } from '../components/AdSlot';
import { SiteLayout } from '../components/SiteLayout';
import { SiteArticle } from '../content/articles';
import { fetchCmsArticle } from '../content/cms';
import { dateLocales } from '../content/localizedContent';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { getSiteUrl, SiteSeo } from '../seo/SiteSeo';

export const ArticlePage = ({
  slug,
  fallbackArticle,
}: {
  slug: string;
  fallbackArticle?: SiteArticle;
}) => {
  const { locale, copy } = useSiteLocale();
  const text = copy.articles;
  const [article, setArticle] = useState<SiteArticle | undefined>(fallbackArticle);
  const [missing, setMissing] = useState(false);
  const siteUrl = getSiteUrl();
  const path = `/tin-tuc/${slug}`;

  useEffect(() => {
    setArticle(fallbackArticle);
    setMissing(false);
    fetchCmsArticle(slug, locale)
      .then((item) => setArticle(item))
      .catch(() => setMissing(!fallbackArticle));
  }, [fallbackArticle, locale, slug]);

  if (!article) {
    return (
      <SiteLayout>
        <section className="article-loading">
          <div className="site-container">
            <span>{missing ? '404' : text.loading}</span>
            <h1>{missing ? text.missing : text.loadingArticle}</h1>
            <a className="site-button site-button--primary" href="/tin-tuc">
              {text.back}
            </a>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <SiteSeo
        title={`${article.title} | TSrecord`}
        description={article.description}
        path={path}
        type="article"
        language={locale}
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
            <a href="/tin-tuc" className="back-link"><ArrowLeft /> {text.all}</a>
            <span className="site-kicker">{article.category}</span>
            <h1>{article.title}</h1>
            <p>{article.description}</p>
            <div className="article-page__meta">
              <span><CalendarDays /> {text.updated} {new Date(article.updatedAt).toLocaleDateString(dateLocales[locale])}</span>
              <span><Clock3 /> {article.readingMinutes} {text.minutes}</span>
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
              <strong>{text.applyTitle}</strong>
              <p>{text.applyText}</p>
              <a href="/app">{copy.common.openApp} <ArrowRight /></a>
            </div>
          </div>
          <aside className="content-rail">
            <AdSlot format="rectangle" />
            <nav className="rail-note" aria-label={text.inArticle}>
              <strong>{text.inArticle}</strong>
              {article.sections.map((section) => <span key={section.heading}>{section.heading}</span>)}
            </nav>
          </aside>
        </div>
      </article>
    </SiteLayout>
  );
};
