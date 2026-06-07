import { lazy, Suspense } from 'react';
import { getArticleForLocale } from './content/localizedContent';
import { useSiteLocale } from './hooks/useSiteLocale';
import { ArticlePage } from './pages/ArticlePage';
import { ArticlesPage } from './pages/ArticlesPage';
import { AboutPage, ContactPage, PrivacyPage, TermsPage } from './pages/InfoPages';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SiteSeo } from './seo/SiteSeo';

const ProductApp = lazy(() => import('../App'));

const normalizePath = (path: string) => {
  const normalized = path.replace(/\/+$/, '');
  return normalized || '/';
};

export const SiteRouter = () => {
  const { locale, copy } = useSiteLocale();
  const path = normalizePath(window.location.pathname);

  if (path === '/app') {
    return (
      <>
        <SiteSeo
          title={copy.common.appTitle}
          description={copy.common.appDescription}
          path="/app"
          noIndex
          language={locale}
        />
        <Suspense fallback={<div className="route-loading">{copy.common.loadingApp}</div>}>
          <ProductApp />
        </Suspense>
      </>
    );
  }
  if (path === '/') return <LandingPage />;
  if (path === '/tin-tuc' || path === '/bai-viet') return <ArticlesPage />;
  if (path === '/gioi-thieu' || path === '/about') return <AboutPage />;
  if (path === '/lien-he' || path === '/contact') return <ContactPage />;
  if (path === '/chinh-sach-bao-mat') return <PrivacyPage />;
  if (path === '/dieu-khoan') return <TermsPage />;

  if (path.startsWith('/tin-tuc/') || path.startsWith('/bai-viet/')) {
    const slug = path.split('/').filter(Boolean).at(-1) || '';
    return <ArticlePage slug={slug} fallbackArticle={getArticleForLocale(slug, locale)} />;
  }

  return <NotFoundPage />;
};
