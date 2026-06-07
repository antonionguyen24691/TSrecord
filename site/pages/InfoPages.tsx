import { ArrowRight, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { SiteLayout } from '../components/SiteLayout';
import { SiteSeo } from '../seo/SiteSeo';

type InfoPageProps = {
  title: string;
  description: string;
  path: string;
  children: React.ReactNode;
};

const InfoPage = ({ title, description, path, children }: InfoPageProps) => (
  <SiteLayout>
    <SiteSeo title={`${title} | TSrecord`} description={description} path={path} />
    <section className="page-hero">
      <div className="site-container page-hero__narrow">
        <span className="site-kicker">TSrecord</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
    <section className="site-section">
      <div className="site-container legal-content">{children}</div>
    </section>
  </SiteLayout>
);

export const AboutPage = () => (
  <InfoPage
    title="Giới thiệu"
    description="TSrecord được xây dựng để giảm thời gian nghe lại và giúp nội dung từ bản ghi đi tiếp vào công việc."
    path="/gioi-thieu"
  >
    <h2>Mục tiêu sản phẩm</h2>
    <p>
      Chúng tôi tập trung vào một quy trình rõ ràng: tiếp nhận bản ghi, tạo văn bản, kiểm tra
      kết quả và lưu lại theo dự án. Công cụ không thay thế trách nhiệm xác minh của người dùng.
    </p>
    <h2>Nguyên tắc phát triển</h2>
    <ul>
      <li>Nội dung người dùng phải được xử lý minh bạch và đúng mục đích.</li>
      <li>Ngôn ngữ nói trong bản ghi cần được tôn trọng, không tự ý dịch.</li>
      <li>Website kiến thức phải hữu ích độc lập, không tồn tại chỉ để đặt quảng cáo.</li>
      <li>Frontend và backend tách biệt để thuận tiện kiểm soát vận hành.</li>
    </ul>
    <a className="text-action" href="/app">Trải nghiệm TSrecord <ArrowRight /></a>
  </InfoPage>
);

export const ContactPage = () => (
  <InfoPage
    title="Liên hệ"
    description="Kênh tiếp nhận câu hỏi về sản phẩm, dữ liệu, hợp tác nội dung và quảng cáo."
    path="/lien-he"
  >
    <div className="contact-grid">
      <article>
        <Mail />
        <h2>Email</h2>
        <p>Gửi yêu cầu hỗ trợ hoặc hợp tác tới:</p>
        <a href="mailto:support@tsrecord.vn">support@tsrecord.vn</a>
      </article>
      <article>
        <MapPin />
        <h2>Khu vực hoạt động</h2>
        <p>TSrecord phục vụ người dùng trực tuyến tại Việt Nam và các thị trường hỗ trợ.</p>
      </article>
      <article>
        <ShieldCheck />
        <h2>Yêu cầu dữ liệu</h2>
        <p>Tiêu đề email nên ghi rõ “Yêu cầu dữ liệu” để được phân loại đúng.</p>
      </article>
    </div>
  </InfoPage>
);

export const PrivacyPage = () => (
  <InfoPage
    title="Chính sách bảo mật"
    description="Thông tin về dữ liệu được xử lý, mục đích sử dụng, lưu trữ cục bộ và công nghệ quảng cáo."
    path="/chinh-sach-bao-mat"
  >
    <p className="legal-updated">Cập nhật ngày 07 tháng 06 năm 2026.</p>
    <h2>Thông tin được xử lý</h2>
    <p>
      Tùy tính năng, TSrecord có thể xử lý tệp âm thanh, video, tài liệu bổ sung, mã thiết bị,
      thông tin gói sử dụng và dữ liệu kỹ thuật cần thiết để cung cấp dịch vụ.
    </p>
    <h2>Mục đích sử dụng</h2>
    <p>
      Dữ liệu được dùng để thực hiện yêu cầu phiên âm, lưu không gian làm việc, xác định quyền
      sử dụng, hỗ trợ kỹ thuật và bảo vệ hệ thống trước hành vi lạm dụng.
    </p>
    <h2>Dịch vụ bên thứ ba và quảng cáo</h2>
    <p>
      Khi quảng cáo được kích hoạt, nhà cung cấp quảng cáo, bao gồm Google, có thể sử dụng
      cookie, địa chỉ IP hoặc các mã định danh khác để phân phối và đo lường quảng cáo. Người
      dùng có thể quản lý lựa chọn quảng cáo trong công cụ cài đặt của nhà cung cấp.
    </p>
    <h2>Quyền của người dùng</h2>
    <p>
      Người dùng có thể yêu cầu giải thích, chỉnh sửa hoặc xóa dữ liệu thuộc phạm vi TSrecord
      kiểm soát bằng cách liên hệ qua trang Liên hệ.
    </p>
  </InfoPage>
);

export const TermsPage = () => (
  <InfoPage
    title="Điều khoản sử dụng"
    description="Các nguyên tắc cơ bản khi sử dụng website, ứng dụng và nội dung của TSrecord."
    path="/dieu-khoan"
  >
    <p className="legal-updated">Cập nhật ngày 07 tháng 06 năm 2026.</p>
    <h2>Phạm vi dịch vụ</h2>
    <p>
      TSrecord cung cấp công cụ hỗ trợ xử lý âm thanh và tổ chức văn bản. Kết quả do AI tạo ra
      có thể có sai sót và cần được người dùng kiểm tra trước khi sử dụng cho quyết định quan trọng.
    </p>
    <h2>Trách nhiệm nội dung</h2>
    <p>
      Người dùng phải có quyền xử lý tệp được tải lên và không sử dụng dịch vụ để xâm phạm
      quyền riêng tư, quyền sở hữu trí tuệ hoặc pháp luật hiện hành.
    </p>
    <h2>Quảng cáo và liên kết ngoài</h2>
    <p>
      Quảng cáo được phân biệt với nội dung biên tập. TSrecord không yêu cầu người dùng nhấp
      quảng cáo để ủng hộ website và không bảo đảm cho nội dung của trang bên thứ ba.
    </p>
    <h2>Thay đổi dịch vụ</h2>
    <p>
      Tính năng và điều khoản có thể được cập nhật để đáp ứng yêu cầu kỹ thuật, pháp lý hoặc
      vận hành. Ngày cập nhật sẽ được công bố trên trang này.
    </p>
  </InfoPage>
);
