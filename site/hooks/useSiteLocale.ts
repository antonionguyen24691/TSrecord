import { useTranslation } from 'react-i18next';
import { normalizeSiteLocale, siteCopy } from '../content/localizedContent';

export const useSiteLocale = () => {
  const { i18n } = useTranslation();
  const locale = normalizeSiteLocale(i18n.resolvedLanguage || i18n.language);
  return { locale, copy: siteCopy[locale] };
};
