import { lazy, Suspense } from 'react';
import { getArticleBySlug } from './content/articles';
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
  const path = normalizePath(window.location.pathname);

  if (path === '/app') {
    return (
      <>
        <SiteSeo
          title="Ứng dụng TSrecord"
          description="Không gian làm việc phiên âm và ghi chép của TSrecord."
          path="/app"
          noIndex
        />
        <Suspense fallback={<div className="route-loading">Đang mở TSrecord...</div>}>
          <ProductApp />
        </Suspense>
      </>
    );
  }
  if (path === '/') return <LandingPage />;
  if (path === '/tin-tuc') return <ArticlesPage />;
  if (path === '/gioi-thieu') return <AboutPage />;
  if (path === '/lien-he') return <ContactPage />;
  if (path === '/chinh-sach-bao-mat') return <PrivacyPage />;
  if (path === '/dieu-khoan') return <TermsPage />;

  if (path.startsWith('/tin-tuc/')) {
    const article = getArticleBySlug(path.slice('/tin-tuc/'.length));
    if (article) return <ArticlePage article={article} />;
  }

  return <NotFoundPage />;
};
