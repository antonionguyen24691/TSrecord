import { ArrowLeft } from 'lucide-react';
import { SiteLayout } from '../components/SiteLayout';
import { SiteSeo } from '../seo/SiteSeo';

export const NotFoundPage = () => (
  <SiteLayout>
    <SiteSeo
      title="Không tìm thấy trang | TSrecord"
      description="Đường dẫn bạn yêu cầu không tồn tại."
      path={window.location.pathname}
      noIndex
    />
    <section className="not-found">
      <div className="site-container">
        <span>404</span>
        <h1>Trang này không tồn tại.</h1>
        <p>Đường dẫn có thể đã thay đổi hoặc nội dung chưa được xuất bản.</p>
        <a className="site-button site-button--primary" href="/"><ArrowLeft /> Về trang chủ</a>
      </div>
    </section>
  </SiteLayout>
);
