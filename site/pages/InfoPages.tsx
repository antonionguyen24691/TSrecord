import { ArrowRight, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import type { ArticleSection } from '../content/articles';
import { type CmsPage, fetchCmsPage } from '../content/cms';
import { SiteSeo } from '../seo/SiteSeo';

type InfoPageProps = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  path: string;
  sections: ArticleSection[];
  metadata?: Record<string, unknown>;
  variant?: 'about' | 'contact' | 'legal';
};

const InfoPage = ({
  slug,
  title,
  description,
  eyebrow,
  path,
  sections,
  metadata = {},
  variant = 'legal',
}: InfoPageProps) => {
  const fallback: CmsPage = {
    slug,
    title,
    description,
    eyebrow,
    content: sections,
    metadata,
    updatedAt: '2026-06-07',
  };
  const [page, setPage] = useState(fallback);

  useEffect(() => {
    fetchCmsPage(slug).then(setPage).catch(() => undefined);
  }, [slug]);

  return (
    <SiteLayout>
      <SiteSeo title={`${page.title} | TSrecord`} description={page.description} path={path} />
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
              <span>Nội dung</span>
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
                  Trải nghiệm TSrecord <ArrowRight />
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
  const email = String(page.metadata.email || 'support@tsrecord.vn');
  const region = String(
    page.metadata.region || 'Phục vụ trực tuyến tại Việt Nam và các thị trường được hỗ trợ.'
  );
  return (
    <section className="site-section contact-section">
      <div className="site-container">
        <div className="contact-intro">
          <span className="site-kicker">Chọn đúng kênh</span>
          <h2>Một đầu mối rõ ràng cho từng nhu cầu.</h2>
        </div>
        <div className="contact-grid">
          <article className="contact-card contact-card--primary">
            <Mail />
            <span>01</span>
            <h2>Email hỗ trợ</h2>
            <p>{page.content[0]?.paragraphs[0]}</p>
            <a href={`mailto:${email}`}>{email} <ArrowRight /></a>
          </article>
          <article className="contact-card">
            <MapPin />
            <span>02</span>
            <h2>Khu vực hoạt động</h2>
            <p>{region}</p>
          </article>
          <article className="contact-card">
            <ShieldCheck />
            <span>03</span>
            <h2>Yêu cầu dữ liệu</h2>
            <p>{page.content[1]?.paragraphs[0]}</p>
          </article>
        </div>
      </div>
    </section>
  );
};

export const AboutPage = () => (
  <InfoPage
    slug="gioi-thieu"
    title="Giới thiệu"
    eyebrow="Về TSrecord"
    description="TSrecord được xây dựng để giảm thời gian nghe lại và giúp nội dung từ bản ghi đi tiếp vào công việc."
    path="/gioi-thieu"
    variant="about"
    sections={[
      {
        heading: 'Từ âm thanh rời rạc đến tri thức có thể sử dụng',
        paragraphs: [
          'TSrecord tập trung vào một quy trình rõ ràng: tiếp nhận bản ghi, tạo văn bản, kiểm tra kết quả và lưu lại theo dự án.',
        ],
      },
      {
        heading: 'Nguyên tắc phát triển',
        paragraphs: ['Minh bạch, tôn trọng ngôn ngữ gốc và để người dùng kiểm soát kết quả.'],
        bullets: [
          'Nội dung được xử lý đúng mục đích.',
          'Không tự ý dịch bản ghi.',
          'Frontend và backend được tách rõ.',
        ],
      },
    ]}
  />
);

export const ContactPage = () => (
  <InfoPage
    slug="lien-he"
    title="Liên hệ"
    eyebrow="Kết nối với đội ngũ"
    description="Kênh tiếp nhận câu hỏi về sản phẩm, dữ liệu, hợp tác nội dung và quảng cáo."
    path="/lien-he"
    variant="contact"
    metadata={{
      email: 'support@tsrecord.vn',
      region: 'Phục vụ trực tuyến tại Việt Nam và các thị trường được hỗ trợ.',
    }}
    sections={[
      {
        heading: 'Hỗ trợ sản phẩm',
        paragraphs: ['Gửi mô tả thiết bị, phiên bản và thao tác gây lỗi để đội ngũ kiểm tra.'],
      },
      {
        heading: 'Yêu cầu dữ liệu',
        paragraphs: ['Ghi rõ “Yêu cầu dữ liệu” trong tiêu đề email để được phân loại đúng.'],
      },
    ]}
  />
);

export const PrivacyPage = () => (
  <InfoPage
    slug="chinh-sach-bao-mat"
    title="Chính sách bảo mật"
    eyebrow="Minh bạch dữ liệu"
    description="Thông tin về dữ liệu được xử lý, mục đích sử dụng, lưu trữ và công nghệ quảng cáo."
    path="/chinh-sach-bao-mat"
    sections={[
      {
        heading: 'Thông tin được xử lý',
        paragraphs: ['TSrecord chỉ xử lý dữ liệu cần thiết để cung cấp các tính năng được yêu cầu.'],
      },
      {
        heading: 'Quyền của người dùng',
        paragraphs: ['Người dùng có thể yêu cầu giải thích, chỉnh sửa hoặc xóa dữ liệu phù hợp.'],
      },
    ]}
  />
);

export const TermsPage = () => (
  <InfoPage
    slug="dieu-khoan"
    title="Điều khoản sử dụng"
    eyebrow="Quy tắc sử dụng"
    description="Các nguyên tắc cơ bản khi sử dụng website, ứng dụng và nội dung của TSrecord."
    path="/dieu-khoan"
    sections={[
      {
        heading: 'Phạm vi dịch vụ',
        paragraphs: ['Kết quả do AI tạo ra cần được người dùng kiểm tra trước khi sử dụng.'],
      },
      {
        heading: 'Trách nhiệm nội dung',
        paragraphs: ['Người dùng phải có quyền xử lý các tệp được tải lên.'],
      },
    ]}
  />
);
