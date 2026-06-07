import { ArrowRight, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { type CmsPage, fetchCmsPage } from '../content/cms';
import { getInfoPageForLocale } from '../content/localizedContent';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { SiteSeo } from '../seo/SiteSeo';

type InfoPageProps = {
  slug: string;
  path: string;
  variant?: 'about' | 'contact' | 'legal';
};

const InfoPage = ({ slug, path, variant = 'legal' }: InfoPageProps) => {
  const { locale, copy } = useSiteLocale();
  const localizedPage = getInfoPageForLocale(slug, locale);
  const fallback = useMemo<CmsPage>(() => ({
    locale,
    slug,
    title: localizedPage.title,
    description: localizedPage.description,
    eyebrow: localizedPage.eyebrow,
    content: localizedPage.sections,
    metadata: localizedPage.metadata || {},
    updatedAt: '2026-06-07',
  }), [locale, localizedPage, slug]);
  const [page, setPage] = useState(fallback);

  useEffect(() => {
    setPage(fallback);
    fetchCmsPage(slug, locale).then(setPage).catch(() => undefined);
  }, [fallback, locale, slug]);

  return (
    <SiteLayout>
      <SiteSeo
        title={`${page.title} | TSrecord`}
        description={page.description}
        path={path}
        language={locale}
      />
      <section className={`page-hero page-hero--${variant}`}>
        <div className="site-container page-hero__narrow">
          <span className="site-kicker">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
      </section>

      {variant === 'contact' ? (
        <ContactContent page={page} />
      ) : (
        <section className="site-section">
          <div className={`site-container info-story info-story--${variant}`}>
            <aside>
              <span>{copy.infoUi.contents}</span>
              {page.content.map((section, index) => (
                <a href={`#section-${index + 1}`} key={section.heading}>
                  {String(index + 1).padStart(2, '0')} {section.heading}
                </a>
              ))}
            </aside>
            <div className="legal-content">
              {page.content.map((section, index) => (
                <section id={`section-${index + 1}`} key={section.heading}>
                  <span className="info-story__index">{String(index + 1).padStart(2, '0')}</span>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && (
                    <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                  )}
                </section>
              ))}
              {variant === 'about' && (
                <a className="text-action" href="/app">
                  {copy.infoUi.experience} <ArrowRight />
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </SiteLayout>
  );
};

const ContactContent = ({ page }: { page: CmsPage }) => {
  const { copy } = useSiteLocale();
  const email = String(page.metadata.email || 'support@tsrecord.vn');
  const region = String(page.metadata.region || '');

  return (
    <section className="site-section contact-section">
      <div className="site-container">
        <div className="contact-intro">
          <span className="site-kicker">{copy.infoUi.contactKicker}</span>
          <h2>{copy.infoUi.contactTitle}</h2>
        </div>
        <div className="contact-grid">
          <article className="contact-card contact-card--primary">
            <Mail />
            <span>01</span>
            <h2>{copy.infoUi.supportEmail}</h2>
            <p>{page.content[0]?.paragraphs[0]}</p>
            <a href={`mailto:${email}`}>{email} <ArrowRight /></a>
          </article>
          <article className="contact-card">
            <MapPin />
            <span>02</span>
            <h2>{copy.infoUi.region}</h2>
            <p>{region}</p>
          </article>
          <article className="contact-card">
            <ShieldCheck />
            <span>03</span>
            <h2>{copy.infoUi.dataRequest}</h2>
            <p>{page.content[1]?.paragraphs[0]}</p>
          </article>
        </div>
      </div>
    </section>
  );
};

export const AboutPage = () => (
  <InfoPage slug="gioi-thieu" path="/gioi-thieu" variant="about" />
);

export const ContactPage = () => (
  <InfoPage slug="lien-he" path="/lien-he" variant="contact" />
);

export const PrivacyPage = () => (
  <InfoPage slug="chinh-sach-bao-mat" path="/chinh-sach-bao-mat" />
);

export const TermsPage = () => (
  <InfoPage slug="dieu-khoan" path="/dieu-khoan" />
);
