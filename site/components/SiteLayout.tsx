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

  useEffect(() => {
    setMenuOpen(false);
  }, []);

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
              <a key={item.href} href={item.href}>
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

        {menuOpen && (
          <nav className="site-mobile-nav" aria-label="Điều hướng di động">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            <a className="site-mobile-nav__cta" href="/app">
              Mở ứng dụng
            </a>
          </nav>
        )}
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
