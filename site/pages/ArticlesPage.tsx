import { ArrowRight, AudioLines } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdSlot } from '../components/AdSlot';
import { SiteLayout } from '../components/SiteLayout';
import { fetchCmsArticles } from '../content/cms';
import { dateLocales, getArticlesForLocale } from '../content/localizedContent';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { SiteSeo } from '../seo/SiteSeo';

export const ArticlesPage = () => {
  const { locale, copy } = useSiteLocale();
  const text = copy.articles;
  const [publishedArticles, setPublishedArticles] = useState(getArticlesForLocale(locale));

  useEffect(() => {
    setPublishedArticles(getArticlesForLocale(locale));
    fetchCmsArticles(locale)
      .then((items) => {
        if (items.length > 0) setPublishedArticles(items);
      })
      .catch(() => undefined);
  }, [locale]);

  return (
    <SiteLayout>
    <SiteSeo
      title={text.seoTitle}
      description={text.seoDescription}
      path="/tin-tuc"
      language={locale}
    />
    <section className="page-hero page-hero--editorial">
      <div className="site-container">
        <span className="site-kicker">{text.kicker}</span>
        <h1>{text.title}</h1>
        <p>{text.description}</p>
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
                  {article.category} · {article.readingMinutes} {text.minutes} ·{' '}
                  {new Date(article.updatedAt).toLocaleDateString(dateLocales[locale])}
                </span>
                <h2><a href={`/tin-tuc/${article.slug}`}>{article.title}</a></h2>
                <p>{article.description}</p>
                <a className="article-link" href={`/tin-tuc/${article.slug}`}>
                  {text.read} <ArrowRight />
                </a>
              </div>
            </article>
          ))}
        </div>
        <div className="content-rail">
          <AdSlot format="rectangle" />
          <aside className="rail-note">
            <strong>{text.railTitle}</strong>
            <p>{text.railText}</p>
            <a href="/app">{copy.common.openApp} <ArrowRight /></a>
          </aside>
        </div>
      </div>
    </section>
    </SiteLayout>
  );
};
