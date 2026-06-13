import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { SiteLanguageSwitcher } from './SiteLanguageSwitcher';

type SiteLayoutProps = {
  children: React.ReactNode;
};

const BrandGlyph = () => (
  <svg viewBox="0 0 36 36" aria-hidden="true">
    <path d="M7 18h3M13 12v12M18 7v22M23 11v14M28 15v6M31 18h-1" />
  </svg>
);

export const SiteLayout = ({ children }: SiteLayoutProps) => {
  const { copy } = useSiteLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const navItems = [
    { href: '/', label: copy.common.home },
    { href: '/tin-tuc', label: copy.common.articles },
    { href: '/gioi-thieu', label: copy.common.about },
    { href: '/lien-he', label: copy.common.contact },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        {copy.common.skip}
      </a>
      <header className="site-header">
        <div className="site-container site-header__inner">
          <a className="site-brand" href="/" aria-label={`TSrecord - ${copy.common.home}`}>
            <span className="site-brand__mark">
              <BrandGlyph />
            </span>
            <span>TSrecord</span>
          </a>

          <nav className="site-nav" aria-label={copy.common.navLabel}>
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={currentPath === item.href ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <SiteLanguageSwitcher />

          <a className="site-header__cta" href="/app">
            {copy.common.openApp}
            <ArrowRight aria-hidden="true" />
          </a>

          <button
            className="site-menu-button"
            type="button"
            aria-label={menuOpen ? copy.common.closeMenu : copy.common.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className={`site-mobile-layer ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
          <button
            className="site-mobile-backdrop"
            type="button"
            aria-label={copy.common.closeMenu}
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => setMenuOpen(false)}
          />
          <nav className="site-mobile-nav" aria-label={copy.common.mobileNavLabel}>
            <div className="site-mobile-nav__intro">
              <span>{copy.common.explore}</span>
              <p>{copy.common.tagline}</p>
            </div>
            {navItems.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                tabIndex={menuOpen ? 0 : -1}
                aria-current={currentPath === item.href ? 'page' : undefined}
              >
                <span>0{index + 1}</span>
                {item.label}
              </a>
            ))}
            <SiteLanguageSwitcher mobile />
            <a className="site-mobile-nav__cta" href="/app" tabIndex={menuOpen ? 0 : -1}>
              {copy.common.openApp}
              <ArrowRight aria-hidden="true" />
            </a>
          </nav>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="site-footer">
        <div className="site-container site-footer__grid">
          <div>
            <a className="site-brand site-brand--footer" href="/">
              <span className="site-brand__mark">
                <BrandGlyph />
              </span>
              <span>TSrecord</span>
            </a>
            <p>{copy.common.footerDescription}</p>
          </div>
          <div>
            <strong>{copy.common.product}</strong>
            <a href="/app">{copy.common.webApp}</a>
            <a href="/tin-tuc">{copy.common.guides}</a>
          </div>
          <div>
            <strong>{copy.common.information}</strong>
            <a href="/gioi-thieu">{copy.common.about}</a>
            <a href="/lien-he">{copy.common.contact}</a>
            <a href="/chinh-sach-bao-mat">{copy.common.privacy}</a>
            <a href="/dieu-khoan">{copy.common.terms}</a>
          </div>
        </div>
        <div className="site-container site-footer__bottom">
          <span>© {new Date().getFullYear()} TSrecord.</span>
          <span>{copy.common.footerNote}</span>
        </div>
      </footer>
    </div>
  );
};
