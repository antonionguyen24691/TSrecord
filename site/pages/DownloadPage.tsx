import { Apple, ArrowRight, Globe, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { appStores, downloadCopy } from '../content/localizedContent';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { getSiteUrl, SiteSeo } from '../seo/SiteSeo';

type PlatformCardProps = {
  icon: ReactNode;
  platform: { name: string; meta: string; description: string; cta: string; comingSoonCta: string };
  href: string;
  available: boolean;
  badge: string;
  badgeTone: 'live' | 'soon';
  recommended?: boolean;
  recommendedLabel?: string;
};

const PlatformCard = ({
  icon,
  platform,
  href,
  available,
  badge,
  badgeTone,
  recommended,
  recommendedLabel,
}: PlatformCardProps) => (
  <article className={`download-card${recommended ? ' download-card--featured' : ''}`}>
    <div className="download-card__head">
      <span className="download-card__icon">{icon}</span>
      <span className={`download-badge download-badge--${badgeTone}`}>{badge}</span>
    </div>
    <span className="download-card__meta">{platform.meta}</span>
    <h2>{platform.name}</h2>
    <p>{platform.description}</p>
    {recommended && <span className="download-card__tag">{recommendedLabel}</span>}
    {available ? (
      <a
        className="site-button site-button--primary download-card__cta"
        href={href}
        {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {platform.cta}
        <ArrowRight aria-hidden="true" />
      </a>
    ) : (
      <span className="download-card__cta download-card__cta--disabled" aria-disabled="true">
        {platform.comingSoonCta}
      </span>
    )}
  </article>
);

export const DownloadPage = () => {
  const { locale, copy } = useSiteLocale();
  const text = downloadCopy[locale];
  const siteUrl = getSiteUrl();

  const androidAvailable = Boolean(appStores.googlePlay);
  const iosAvailable = Boolean(appStores.appStore);

  return (
    <SiteLayout>
      <SiteSeo
        title={`${text.seoTitle} | TSrecord`}
        description={text.seoDescription}
        path="/tai-app"
        language={locale}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'TSrecord',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Android, iOS, Web',
          softwareVersion: appStores.appVersion,
          url: `${siteUrl}/tai-app`,
          downloadUrl: `${siteUrl}/app`,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
        }}
      />

      <section className="page-hero page-hero--download">
        <div className="site-container page-hero__narrow">
          <span className="site-kicker">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="download-grid">
            <PlatformCard
              icon={<Smartphone aria-hidden="true" />}
              platform={text.android}
              href={appStores.googlePlay || appStores.webApp}
              available={androidAvailable}
              badge={androidAvailable ? text.availableNow : text.comingSoon}
              badgeTone={androidAvailable ? 'live' : 'soon'}
            />
            <PlatformCard
              icon={<Apple aria-hidden="true" />}
              platform={text.ios}
              href={appStores.appStore || appStores.webApp}
              available={iosAvailable}
              badge={iosAvailable ? text.availableNow : text.comingSoon}
              badgeTone={iosAvailable ? 'live' : 'soon'}
            />
            <PlatformCard
              icon={<Globe aria-hidden="true" />}
              platform={text.web}
              href={appStores.webApp}
              available
              badge={text.availableNow}
              badgeTone="live"
              recommended
              recommendedLabel={text.recommended}
            />
          </div>
        </div>
      </section>

      <section className="site-section site-section--ink">
        <div className="site-container download-info">
          <div className="download-info__block">
            <span className="site-kicker site-kicker--light">{text.requirementsTitle}</span>
            <ul className="download-requirements">
              {text.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
            <p className="download-version">
              {text.versionLabel}: <strong>{appStores.appVersion}</strong>
            </p>
          </div>
          <div className="download-info__block download-help">
            <h2>{text.helpTitle}</h2>
            <p>{text.helpText}</p>
            <a className="site-button site-button--light" href="/lien-he">
              {text.helpCta}
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};
