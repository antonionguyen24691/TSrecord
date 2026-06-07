import { Languages } from 'lucide-react';
import { setPersistedLanguage } from '../../i18n';
import { localeNames, siteLocales } from '../content/localizedContent';
import { useSiteLocale } from '../hooks/useSiteLocale';

export const SiteLanguageSwitcher = ({ mobile = false }: { mobile?: boolean }) => {
  const { locale, copy } = useSiteLocale();

  const changeLanguage = async (nextLocale: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', nextLocale);
    window.history.replaceState({}, '', url);
    await setPersistedLanguage(nextLocale);
  };

  return (
    <label className={`site-language ${mobile ? 'site-language--mobile' : ''}`}>
      <Languages aria-hidden="true" />
      <span className="sr-only">{copy.common.language}</span>
      <select
        aria-label={copy.common.language}
        value={locale}
        onChange={(event) => void changeLanguage(event.target.value)}
      >
        {siteLocales.map((value) => (
          <option key={value} value={value}>{localeNames[value]}</option>
        ))}
      </select>
    </label>
  );
};
