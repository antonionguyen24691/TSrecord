import {
  ArrowRight,
  AudioLines,
  BookOpenText,
  Check,
  FileAudio,
  FolderKanban,
  Languages,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { fetchCmsArticles } from '../content/cms';
import { getArticlesForLocale } from '../content/localizedContent';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { getSiteUrl, SiteSeo } from '../seo/SiteSeo';

export const LandingPage = () => {
  const { locale, copy } = useSiteLocale();
  const text = copy.landing;
  const siteUrl = getSiteUrl();
  const [featuredArticles, setFeaturedArticles] = useState(
    getArticlesForLocale(locale).slice(0, 3)
  );

  useEffect(() => {
    setFeaturedArticles(getArticlesForLocale(locale).slice(0, 3));
    fetchCmsArticles(locale)
      .then((items) => {
        const featured = items.filter((item) => item.featured).slice(0, 3);
        if (featured.length > 0) setFeaturedArticles(featured);
      })
      .catch(() => undefined);
  }, [locale]);

  return (
    <SiteLayout>
      <SiteSeo
        title={text.seoTitle}
        description={text.seoDescription}
        path="/"
        language={locale}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'TSrecord',
            url: siteUrl,
            logo: `${siteUrl}/logo.svg`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'TSrecord',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, Android, iOS',
            url: `${siteUrl}/app`,
            description: text.seoDescription,
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'VND',
            },
          },
        ]}
      />

      <section className="site-hero">
        <div className="site-container site-hero__grid">
          <div className="site-hero__copy">
            <div className="site-eyebrow">
              <AudioLines aria-hidden="true" />
              {text.eyebrow}
            </div>
            <h1>{text.title}</h1>
            <p>{text.description}</p>
            <div className="site-hero__actions">
              <a className="site-button site-button--primary" href="/app">
                {text.start}
                <ArrowRight aria-hidden="true" />
              </a>
              <a className="site-button site-button--secondary" href="/tin-tuc">
                {text.viewGuides}
              </a>
            </div>
            <div className="site-hero__trust">
              <span><Check /> {text.trustWeb}</span>
              <span><Check /> {text.trustAi}</span>
            </div>
          </div>

          <div className="product-scene" aria-label={text.sceneLabel}>
            <div className="product-scene__top">
              <span className="product-scene__dot" />
              <span>{text.session}</span>
              <strong>{text.processing}</strong>
            </div>
            <div className="product-scene__wave" aria-hidden="true">
              {Array.from({ length: 38 }).map((_, index) => (
                <i key={index} style={{ height: `${18 + ((index * 17) % 54)}%` }} />
              ))}
            </div>
            <div className="product-scene__timeline">
              <span>00:00</span>
              <div>
                <strong>{text.speaker}</strong>
                <p>{text.transcript}</p>
              </div>
            </div>
            <div className="product-scene__timeline product-scene__timeline--active">
              <span>02:18</span>
              <div>
                <strong>{text.decision}</strong>
                <p>{text.decisionText}</p>
              </div>
            </div>
            <div className="product-scene__status">
              <span><FileAudio /> {text.audioLength}</span>
              <span><Languages /> {text.sourceLanguage}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="site-proof">
        <div className="site-container site-proof__row">
          <p>{text.proof}</p>
          {text.useCases.map((useCase) => <span key={useCase}>{useCase}</span>)}
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-section__heading site-section__heading--split">
            <div>
              <span className="site-kicker">{text.flowKicker}</span>
              <h2>{text.flowTitle}</h2>
            </div>
            <p>{text.flowDescription}</p>
          </div>

          <div className="feature-layout">
            <article className="feature-panel feature-panel--large">
              <span className="feature-panel__icon"><FileAudio /></span>
              <div>
                <span className="feature-panel__number">01</span>
                <h3>{text.features[0][0]}</h3>
                <p>{text.features[0][1]}</p>
              </div>
            </article>
            <article className="feature-panel">
              <span className="feature-panel__icon"><Sparkles /></span>
              <span className="feature-panel__number">02</span>
              <h3>{text.features[1][0]}</h3>
              <p>{text.features[1][1]}</p>
            </article>
            <article className="feature-panel feature-panel--dark">
              <span className="feature-panel__icon"><FolderKanban /></span>
              <span className="feature-panel__number">03</span>
              <h3>{text.features[2][0]}</h3>
              <p>{text.features[2][1]}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section site-section--ink">
        <div className="site-container security-grid">
          <div>
            <span className="site-kicker site-kicker--light">{text.controlKicker}</span>
            <h2>{text.controlTitle}</h2>
            <p>{text.controlDescription}</p>
            <a href="/chinh-sach-bao-mat">
              {text.readPrivacy} <ArrowRight />
            </a>
          </div>
          <div className="security-points">
            <article>
              <LockKeyhole />
              <div>
                <h3>{text.controls[0][0]}</h3>
                <p>{text.controls[0][1]}</p>
              </div>
            </article>
            <article>
              <Languages />
              <div>
                <h3>{text.controls[1][0]}</h3>
                <p>{text.controls[1][1]}</p>
              </div>
            </article>
            <article>
              <BookOpenText />
              <div>
                <h3>{text.controls[2][0]}</h3>
                <p>{text.controls[2][1]}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section site-section--editorial">
        <div className="site-container">
          <div className="site-section__heading site-section__heading--row">
            <div>
              <span className="site-kicker">{text.knowledgeKicker}</span>
              <h2>{text.knowledgeTitle}</h2>
            </div>
            <a href="/tin-tuc">{text.viewAll} <ArrowRight /></a>
          </div>
          <div className="article-grid">
            {featuredArticles.map((article, index) => (
              <article className={index === 0 ? 'article-card article-card--featured' : 'article-card'} key={article.slug}>
                <div className="article-card__visual" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <AudioLines />
                </div>
                <div className="article-card__body">
                  <span>{article.category} · {article.readingMinutes} {text.minutesRead}</span>
                  <h3><a href={`/tin-tuc/${article.slug}`}>{article.title}</a></h3>
                  <p>{article.description}</p>
                  <a href={`/tin-tuc/${article.slug}`}>{text.readArticle} <ArrowRight /></a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-cta">
        <div className="site-container site-cta__inner">
          <div>
            <span className="site-kicker">{text.ctaKicker}</span>
            <h2>{text.ctaTitle}</h2>
          </div>
          <a className="site-button site-button--light" href="/app">
            {text.ctaButton} <ArrowRight />
          </a>
        </div>
      </section>
    </SiteLayout>
  );
};
