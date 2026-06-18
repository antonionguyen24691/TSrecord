import { ArrowRight, Check, KeyRound, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { useSiteLocale } from '../hooks/useSiteLocale';
import { fetchPublicPaymentInfo, type PublicPaymentInfo } from '../services/publicConfig';
import { getSiteUrl, SiteSeo } from '../seo/SiteSeo';

const fallbackPricing: Record<string, number> = {
  monthly_20: 39000,
  monthly_50: 59000,
  monthly_100: 99000,
  own_key_ads: 199000,
  own_key_no_ads: 248000,
  disable_ads: 49000,
};

const copy = {
  vi: {
    seoTitle: 'Bảng giá TSrecord - Gói phiên âm và xử lý ghi âm',
    seoDescription: 'Chọn gói TSrecord phù hợp: gói lượt phiên âm, dùng key cá nhân, tắt quảng cáo hoặc tư vấn gói riêng.',
    eyebrow: 'Bảng giá',
    title: 'Chọn gói xử lý bản ghi theo nhu cầu thật.',
    description: 'Các gói công khai dành cho nhu cầu cá nhân và nhóm nhỏ. Nếu cần triển khai riêng, dùng luồng tư vấn để đội ngũ ghi nhận yêu cầu.',
    popular: 'Phổ biến',
    buy: 'Chọn gói',
    contact: 'Trao đổi nhu cầu riêng',
    privateTitle: 'Cần gói riêng cho đội nhóm hoặc quy trình đặc thù?',
    privateDescription: 'Gửi nhu cầu qua luồng đăng ký để chúng tôi nắm số lượng người dùng, khối lượng xử lý, yêu cầu bảo mật và kênh thanh toán phù hợp.',
    privateCta: 'Đăng ký tư vấn gói riêng',
    plans: [
      ['monthly_20', 'Tiêu chuẩn', '20 lượt/tháng', ['Dùng key hệ thống', 'Tắt quảng cáo', 'Phù hợp nhu cầu nhẹ']],
      ['monthly_50', 'Nâng cao', '50 lượt/tháng', ['Dùng key hệ thống', 'Tắt quảng cáo', 'Cho lịch làm việc đều đặn']],
      ['monthly_100', 'Chuyên nghiệp', '100 lượt/tháng', ['Dùng key hệ thống', 'Tắt quảng cáo', 'Cho nhóm nhỏ và creator']],
    ],
    addons: [
      ['own_key_ads', 'Key cá nhân có quảng cáo', 'Tự dùng API key riêng, giữ chi phí linh hoạt.'],
      ['own_key_no_ads', 'Key cá nhân không quảng cáo', 'Tự dùng API key riêng và loại bỏ quảng cáo.'],
      ['disable_ads', 'Tắt quảng cáo', 'Loại bỏ quảng cáo cho trải nghiệm tập trung hơn.'],
    ],
  },
  en: {
    seoTitle: 'TSrecord Pricing - Transcription and recording plans',
    seoDescription: 'Choose a TSrecord plan for transcription credits, personal API keys, ad removal, or a private consultation.',
    eyebrow: 'Pricing',
    title: 'Pick a recording workflow plan that matches real use.',
    description: 'Public plans cover individuals and small teams. For a private setup, send your needs through the consultation flow.',
    popular: 'Popular',
    buy: 'Choose plan',
    contact: 'Discuss private needs',
    privateTitle: 'Need a private plan for a team or special workflow?',
    privateDescription: 'Share user count, processing volume, security needs, and payment preferences through the registration flow.',
    privateCta: 'Register for private consultation',
    plans: [
      ['monthly_20', 'Standard', '20 requests/month', ['System AI keys', 'Ads off', 'For light usage']],
      ['monthly_50', 'Advanced', '50 requests/month', ['System AI keys', 'Ads off', 'For regular work']],
      ['monthly_100', 'Professional', '100 requests/month', ['System AI keys', 'Ads off', 'For small teams and creators']],
    ],
    addons: [
      ['own_key_ads', 'Personal key with ads', 'Use your own API key and keep costs flexible.'],
      ['own_key_no_ads', 'Personal key without ads', 'Use your own API key and remove ads.'],
      ['disable_ads', 'Ad removal', 'Remove ads for a more focused workspace.'],
    ],
  },
  zh: {
    seoTitle: 'TSrecord 价格 - 转写与录音处理套餐',
    seoDescription: '选择 TSrecord 套餐：转写额度、个人 API Key、去广告或私有方案咨询。',
    eyebrow: '价格',
    title: '按真实使用需求选择录音处理方案。',
    description: '公开套餐适合个人和小团队。若需私有部署或专属流程，请通过咨询入口提交需求。',
    popular: '热门',
    buy: '选择套餐',
    contact: '咨询专属需求',
    privateTitle: '团队或特殊流程需要专属方案？',
    privateDescription: '通过注册流程提交用户数量、处理量、安全要求和付款偏好。',
    privateCta: '登记专属方案咨询',
    plans: [
      ['monthly_20', '标准', '20 次/月', ['系统 AI Key', '无广告', '适合轻量使用']],
      ['monthly_50', '进阶', '50 次/月', ['系统 AI Key', '无广告', '适合稳定工作量']],
      ['monthly_100', '专业', '100 次/月', ['系统 AI Key', '无广告', '适合小团队和创作者']],
    ],
    addons: [
      ['own_key_ads', '个人 Key 含广告', '使用自己的 API Key，成本更灵活。'],
      ['own_key_no_ads', '个人 Key 无广告', '使用自己的 API Key，并移除广告。'],
      ['disable_ads', '去广告', '移除广告，保持专注。'],
    ],
  },
  ko: {
    seoTitle: 'TSrecord 요금 - 전사 및 녹음 처리 플랜',
    seoDescription: '전사 크레딧, 개인 API 키, 광고 제거, 전용 상담을 위한 TSrecord 플랜을 선택하세요.',
    eyebrow: '요금',
    title: '실제 사용량에 맞는 녹음 처리 플랜을 선택하세요.',
    description: '공개 플랜은 개인과 소규모 팀에 적합합니다. 전용 구성이 필요하면 상담 흐름으로 요구사항을 보내 주세요.',
    popular: '인기',
    buy: '플랜 선택',
    contact: '전용 요구사항 상담',
    privateTitle: '팀이나 특별한 워크플로에 전용 플랜이 필요하신가요?',
    privateDescription: '등록 흐름에서 사용자 수, 처리량, 보안 요구사항, 결제 선호도를 공유하세요.',
    privateCta: '전용 상담 등록',
    plans: [
      ['monthly_20', '스탠더드', '월 20회', ['시스템 AI 키', '광고 없음', '가벼운 사용에 적합']],
      ['monthly_50', '어드밴스드', '월 50회', ['시스템 AI 키', '광고 없음', '정기적인 작업에 적합']],
      ['monthly_100', '프로페셔널', '월 100회', ['시스템 AI 키', '광고 없음', '소규모 팀과 크리에이터용']],
    ],
    addons: [
      ['own_key_ads', '개인 키 및 광고', '본인 API 키를 사용해 비용을 유연하게 관리합니다.'],
      ['own_key_no_ads', '개인 키 및 광고 없음', '본인 API 키를 사용하고 광고를 제거합니다.'],
      ['disable_ads', '광고 제거', '더 집중된 작업 공간을 위해 광고를 제거합니다.'],
    ],
  },
} as const;

const formatVnd = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

const appPlanUrl = (planCode: string) =>
  `/app?intent=upgrade&planCode=${encodeURIComponent(planCode)}`;

const privatePlanUrl = () => {
  const params = new URLSearchParams({
    intent: 'consult',
    addon: 'private-plan',
    note: 'pricing-private-plan',
  });
  return `/app?${params.toString()}`;
};

export const PricingPage = () => {
  const { locale } = useSiteLocale();
  const text = copy[locale] || copy.vi;
  const [paymentInfo, setPaymentInfo] = useState<PublicPaymentInfo | null>(null);
  const siteUrl = getSiteUrl();

  useEffect(() => {
    fetchPublicPaymentInfo().then(setPaymentInfo);
  }, []);

  const pricing = useMemo(
    () => ({ ...fallbackPricing, ...(paymentInfo?.pricing || {}) }),
    [paymentInfo?.pricing]
  );

  return (
    <SiteLayout>
      <SiteSeo
        title={text.seoTitle}
        description={text.seoDescription}
        path="/pricing"
        language={locale}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'TSrecord',
          url: `${siteUrl}/pricing`,
          offers: text.plans.map(([code, name]) => ({
            '@type': 'Offer',
            name,
            price: pricing[code],
            priceCurrency: 'VND',
            url: `${siteUrl}${appPlanUrl(code)}`,
          })),
        }}
      />

      <section className="page-hero page-hero--pricing">
        <div className="site-container page-hero__narrow">
          <span className="site-kicker">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>
      </section>

      <section className="pricing-section">
        <div className="site-container">
          <div className="pricing-scroll">
            <div className="pricing-grid">
              {text.plans.map(([code, name, quota, features], index) => (
                <article className={`pricing-card${index === 1 ? ' pricing-card--featured' : ''}`} key={code}>
                  <div className="pricing-card__top">
                    <span className="pricing-card__icon">
                      {index === 1 ? <Sparkles /> : <ShieldCheck />}
                    </span>
                    {index === 1 && <strong>{text.popular}</strong>}
                  </div>
                  <h2>{name}</h2>
                  <p>{quota}</p>
                  <div className="pricing-card__price">{formatVnd(pricing[code] || fallbackPricing[code])}</div>
                  <ul>
                    {features.map((feature) => (
                      <li key={feature}><Check /> {feature}</li>
                    ))}
                  </ul>
                  <a className="site-button site-button--primary" href={appPlanUrl(code)}>
                    {text.buy}
                    <ArrowRight aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
          </div>

          <div className="pricing-addons">
            {text.addons.map(([code, name, description]) => (
              <a className="pricing-addon" href={appPlanUrl(code)} key={code}>
                <KeyRound aria-hidden="true" />
                <span>
                  <strong>{name}</strong>
                  <small>{formatVnd(pricing[code] || fallbackPricing[code])}</small>
                  <em>{description}</em>
                </span>
                <ArrowRight aria-hidden="true" />
              </a>
            ))}
          </div>

          <section className="pricing-private">
            <MessageCircle aria-hidden="true" />
            <span className="site-kicker">{text.contact}</span>
            <h2>{text.privateTitle}</h2>
            <p>{text.privateDescription}</p>
            <a className="site-button site-button--secondary" href={privatePlanUrl()}>
              {text.privateCta}
              <ArrowRight aria-hidden="true" />
            </a>
          </section>
        </div>
      </section>
    </SiteLayout>
  );
};
