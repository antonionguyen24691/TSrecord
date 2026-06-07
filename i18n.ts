import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { Preferences } from '@capacitor/preferences';

import viCommon from './locales/vi/common.json';
import enCommon from './locales/en/common.json';
import zhCommon from './locales/zh/common.json';
import koCommon from './locales/ko/common.json';

const resources = {
  vi: { translation: viCommon },
  en: { translation: enCommon },
  zh: { translation: zhCommon },
  ko: { translation: koCommon },
};

// Initialize i18n with detector
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [], // we will use Capacitor Preferences manually
    },
  });

// Setup custom persistence using Capacitor Preferences
const PREF_KEY = 'tsrecord_user_lang';

export const initLanguagePersistence = async () => {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (value && ['vi', 'en', 'zh', 'ko'].includes(value)) {
      await i18n.changeLanguage(value);
    }
  } catch (error) {
    console.error('Failed to load persisted language:', error);
  }
};

export const setPersistedLanguage = async (lang: string) => {
  try {
    await i18n.changeLanguage(lang);
    await Preferences.set({ key: PREF_KEY, value: lang });
  } catch (error) {
    console.error('Failed to persist language:', error);
  }
};

export default i18n;
