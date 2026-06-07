import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, Mic2, X } from 'lucide-react';

type SiteLayoutProps = {
  children: React.ReactNode;
};

const navItems = [
  { href: '/', label: 'Trang chủ' },
  { href: '/tin-tuc', label: 'Bài viết' },
  { href: '/gioi-thieu', label: 'Giới thiệu' },
  { href: '/lien-he', label: 'Liên hệ' },
];

export const SiteLayout = ({ children }: SiteLayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

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
        Đi đến nội dung
      </a>
      <header className="site-header">
        <div className="site-container site-header__inner">
          <a className="site-brand" href="/" aria-label="TSrecord - Trang chủ">
            <span className="site-brand__mark">
              <Mic2 aria-hidden="true" />
            </span>
            <span>TSrecord</span>
          </a>

          <nav className="site-nav" aria-label="Điều hướng chính">
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

          <a className="site-header__cta" href="/app">
            Mở ứng dụng
            <ArrowRight aria-hidden="true" />
          </a>

          <button
            className="site-menu-button"
            type="button"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
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
            aria-label="Đóng menu"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => setMenuOpen(false)}
          />
          <nav className="site-mobile-nav" aria-label="Điều hướng di động">
            <div className="site-mobile-nav__intro">
              <span>Khám phá TSrecord</span>
              <p>Từ bản ghi đến nội dung có thể sử dụng.</p>
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
            <a className="site-mobile-nav__cta" href="/app" tabIndex={menuOpen ? 0 : -1}>
              Mở ứng dụng
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
                <Mic2 aria-hidden="true" />
              </span>
              <span>TSrecord</span>
            </a>
            <p>Công cụ ghi âm, phiên âm và tổ chức nội dung dành cho công việc thực tế.</p>
          </div>
          <div>
            <strong>Sản phẩm</strong>
            <a href="/app">Ứng dụng web</a>
            <a href="/tin-tuc">Kiến thức và hướng dẫn</a>
          </div>
          <div>
            <strong>Thông tin</strong>
            <a href="/gioi-thieu">Giới thiệu</a>
            <a href="/lien-he">Liên hệ</a>
            <a href="/chinh-sach-bao-mat">Chính sách bảo mật</a>
            <a href="/dieu-khoan">Điều khoản sử dụng</a>
          </div>
        </div>
        <div className="site-container site-footer__bottom">
          <span>© {new Date().getFullYear()} TSrecord.</span>
          <span>Nội dung được biên soạn cho người dùng Việt Nam.</span>
        </div>
      </footer>
    </div>
  );
};
