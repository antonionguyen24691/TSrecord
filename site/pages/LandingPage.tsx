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
import { SiteLayout } from '../components/SiteLayout';
import { articles } from '../content/articles';
import { getSiteUrl, SiteSeo } from '../seo/SiteSeo';

export const LandingPage = () => {
  const siteUrl = getSiteUrl();
  const featuredArticles = articles.slice(0, 3);

  return (
    <SiteLayout>
      <SiteSeo
        title="TSrecord - Chuyển ghi âm thành văn bản và ghi chép cuộc họp"
        description="Ghi âm, chuyển âm thanh thành văn bản, tạo biên bản cuộc họp và quản lý nội dung trong một quy trình rõ ràng."
        path="/"
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
            description:
              'Ứng dụng ghi âm, chuyển âm thanh thành văn bản và tổ chức biên bản cuộc họp.',
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
              Từ bản ghi đến tài liệu có thể sử dụng
            </div>
            <h1>Nghe lại ít hơn. Nắm đúng nội dung cần làm.</h1>
            <p>
              TSrecord giúp chuyển ghi âm thành văn bản, tạo biên bản và sắp xếp nội dung
              theo từng phiên làm việc. Bạn kiểm soát nguồn âm, ngôn ngữ và kết quả cuối cùng.
            </p>
            <div className="site-hero__actions">
              <a className="site-button site-button--primary" href="/app">
                Bắt đầu phiên âm
                <ArrowRight aria-hidden="true" />
              </a>
              <a className="site-button site-button--secondary" href="/tin-tuc">
                Xem hướng dẫn
              </a>
            </div>
            <div className="site-hero__trust">
              <span><Check /> Không cần cài đặt trên web</span>
              <span><Check /> Hỗ trợ nhiều nhà cung cấp AI</span>
            </div>
          </div>

          <div className="product-scene" aria-label="Minh họa quy trình xử lý bản ghi">
            <div className="product-scene__top">
              <span className="product-scene__dot" />
              <span>Phiên họp sản phẩm - 07/06/2026</span>
              <strong>Đang xử lý</strong>
            </div>
            <div className="product-scene__wave" aria-hidden="true">
              {Array.from({ length: 38 }).map((_, index) => (
                <i key={index} style={{ height: `${18 + ((index * 17) % 54)}%` }} />
              ))}
            </div>
            <div className="product-scene__timeline">
              <span>00:00</span>
              <div>
                <strong>Người nói 1</strong>
                <p>Chúng ta cần thống nhất phạm vi phát hành và người phụ trách kiểm thử.</p>
              </div>
            </div>
            <div className="product-scene__timeline product-scene__timeline--active">
              <span>02:18</span>
              <div>
                <strong>Quyết định</strong>
                <p>Phát hành bản thử nghiệm nội bộ sau khi hoàn tất kiểm tra dữ liệu.</p>
              </div>
            </div>
            <div className="product-scene__status">
              <span><FileAudio /> 42 phút âm thanh</span>
              <span><Languages /> Giữ ngôn ngữ gốc</span>
            </div>
          </div>
        </div>
      </section>

      <section className="site-proof">
        <div className="site-container site-proof__row">
          <p>Dùng cho những công việc cần nghe kỹ và lưu lại có hệ thống</p>
          <span>Cuộc họp</span>
          <span>Phỏng vấn</span>
          <span>Nghiên cứu</span>
          <span>Nội dung số</span>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="site-section__heading site-section__heading--split">
            <div>
              <span className="site-kicker">Một quy trình liền mạch</span>
              <h2>Không dừng lại ở một bản transcript dài.</h2>
            </div>
            <p>
              Kết quả được tổ chức để bạn có thể kiểm tra, chỉnh sửa, xuất tài liệu và tiếp
              tục công việc mà không phải chuyển qua nhiều công cụ rời rạc.
            </p>
          </div>

          <div className="feature-layout">
            <article className="feature-panel feature-panel--large">
              <span className="feature-panel__icon"><FileAudio /></span>
              <div>
                <span className="feature-panel__number">01</span>
                <h3>Đưa tệp vào hoặc ghi âm trực tiếp</h3>
                <p>Tiếp nhận âm thanh, video và tài liệu bổ sung trong cùng một phiên làm việc.</p>
              </div>
            </article>
            <article className="feature-panel">
              <span className="feature-panel__icon"><Sparkles /></span>
              <span className="feature-panel__number">02</span>
              <h3>Phiên âm theo mục đích</h3>
              <p>Chọn văn bản liền mạch hoặc mốc thời gian để phù hợp với cách sử dụng.</p>
            </article>
            <article className="feature-panel feature-panel--dark">
              <span className="feature-panel__icon"><FolderKanban /></span>
              <span className="feature-panel__number">03</span>
              <h3>Lưu theo dự án</h3>
              <p>Giữ bản ghi, ghi chú và kết quả đã chỉnh sửa trong một không gian làm việc.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section site-section--ink">
        <div className="site-container security-grid">
          <div>
            <span className="site-kicker site-kicker--light">Kiểm soát và minh bạch</span>
            <h2>Dữ liệu công việc cần một quy trình có trách nhiệm.</h2>
            <p>
              TSrecord tách rõ ứng dụng, website nội dung và backend dịch vụ. Khóa truy cập
              nhạy cảm không được đưa vào nội dung công khai hoặc bài viết.
            </p>
            <a href="/chinh-sach-bao-mat">
              Đọc chính sách bảo mật <ArrowRight />
            </a>
          </div>
          <div className="security-points">
            <article>
              <LockKeyhole />
              <div>
                <h3>Cấu hình backend riêng</h3>
                <p>Frontend kết nối dịch vụ qua URL môi trường, thuận tiện thay đổi hạ tầng.</p>
              </div>
            </article>
            <article>
              <Languages />
              <div>
                <h3>Giữ ngôn ngữ nội dung</h3>
                <p>Ưu tiên phiên âm đúng ngôn ngữ nói thay vì tự động dịch ngoài yêu cầu.</p>
              </div>
            </article>
            <article>
              <BookOpenText />
              <div>
                <h3>Nội dung có nguồn gốc rõ</h3>
                <p>Bài viết hướng dẫn phục vụ người dùng, không tạo trang rỗng chỉ để đặt quảng cáo.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section site-section--editorial">
        <div className="site-container">
          <div className="site-section__heading site-section__heading--row">
            <div>
              <span className="site-kicker">Kiến thức thực hành</span>
              <h2>Hướng dẫn làm việc với bản ghi.</h2>
            </div>
            <a href="/tin-tuc">Xem tất cả bài viết <ArrowRight /></a>
          </div>
          <div className="article-grid">
            {featuredArticles.map((article, index) => (
              <article className={index === 0 ? 'article-card article-card--featured' : 'article-card'} key={article.slug}>
                <div className="article-card__visual" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <AudioLines />
                </div>
                <div className="article-card__body">
                  <span>{article.category} · {article.readingMinutes} phút đọc</span>
                  <h3><a href={`/tin-tuc/${article.slug}`}>{article.title}</a></h3>
                  <p>{article.description}</p>
                  <a href={`/tin-tuc/${article.slug}`}>Đọc bài viết <ArrowRight /></a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-cta">
        <div className="site-container site-cta__inner">
          <div>
            <span className="site-kicker">Bắt đầu từ tệp của bạn</span>
            <h2>Biến một bản ghi thành tài liệu có thể hành động.</h2>
          </div>
          <a className="site-button site-button--light" href="/app">
            Mở TSrecord <ArrowRight />
          </a>
        </div>
      </section>
    </SiteLayout>
  );
};
