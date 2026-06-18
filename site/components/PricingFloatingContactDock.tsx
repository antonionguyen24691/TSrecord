import { Bot, Phone } from 'lucide-react';
import type { PricingContactConfig } from '../services/publicConfig';

type PricingFloatingContactDockProps = {
  config?: PricingContactConfig;
  companyPhone?: string;
};

const stripPhone = (value: string) => value.replace(/[^\d+]/g, '');

const isInternalRoute = (path: string) =>
  path === '/login'
  || path.startsWith('/app')
  || path.startsWith('/admin')
  || path.startsWith('/sales')
  || path.includes('/login');

export const PricingFloatingContactDock = ({
  config,
  companyPhone,
}: PricingFloatingContactDockProps) => {
  if (!config || config.pricingContactEnabled === false || isInternalRoute(window.location.pathname)) {
    return null;
  }

  const fallbackUrl = config.followUrl?.trim() || '';
  const botUrl = config.pricingBotUrl?.trim() || fallbackUrl;
  const zaloUrl = config.pricingZaloUrl?.trim() || fallbackUrl;
  const phone = stripPhone(config.pricingSalesPhone?.trim() || companyPhone?.trim() || '');
  const label = config.pricingContactLabel?.trim() || 'Tư vấn mua gói';

  if (!botUrl && !zaloUrl && !phone) return null;

  return (
    <aside className="pricing-contact-dock" aria-label="Liên hệ tư vấn mua gói">
      {botUrl && (
        <a
          className="pricing-contact-dock__bot"
          href={botUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Bot aria-hidden="true" />
          <span>{label}</span>
        </a>
      )}
      {zaloUrl && (
        <a
          className="pricing-contact-dock__circle pricing-contact-dock__zalo"
          href={zaloUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat Zalo"
        >
          Za
        </a>
      )}
      {phone && (
        <a
          className="pricing-contact-dock__circle"
          href={`tel:${phone}`}
          aria-label="Gọi sales"
        >
          <Phone aria-hidden="true" />
        </a>
      )}
    </aside>
  );
};
