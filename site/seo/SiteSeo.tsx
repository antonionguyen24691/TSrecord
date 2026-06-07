import { useEffect } from 'react';

type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

type SiteSeoProps = {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  image?: string;
  jsonLd?: JsonLd;
  noIndex?: boolean;
  language?: string;
};

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
};

const upsertCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
};

export const getSiteUrl = () =>
  (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');

export const SiteSeo = ({
  title,
  description,
  path,
  type = 'website',
  image = '/og-cover.svg',
  jsonLd,
  noIndex = false,
  language = 'vi',
}: SiteSeoProps) => {
  useEffect(() => {
    const siteUrl = getSiteUrl();
    const canonical = `${siteUrl}${path === '/' ? '' : path}`;
    const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;

    document.title = title;
    document.documentElement.lang = language;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: language });
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    });
    upsertCanonical(canonical);

    const previousJsonLd = document.head.querySelector('#site-json-ld');
    previousJsonLd?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'site-json-ld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.head.querySelector('#site-json-ld')?.remove();
    };
  }, [description, image, jsonLd, language, noIndex, path, title, type]);

  return null;
};
