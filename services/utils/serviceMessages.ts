import i18n from '../../i18n';

type TranslateOptions = Record<string, unknown>;

type SupportedLanguage = 'vi' | 'en' | 'zh' | 'ko';

const normalizeLanguage = (value?: string | null): SupportedLanguage => {
  const candidate = (value || '').toLowerCase();
  if (candidate.startsWith('en')) return 'en';
  if (candidate.startsWith('zh')) return 'zh';
  if (candidate.startsWith('ko')) return 'ko';
  return 'vi';
};

export const getCurrentAppLanguage = (): SupportedLanguage =>
  normalizeLanguage(i18n.resolvedLanguage || i18n.language);

export const translateServiceMessage = (
  key: string,
  options?: TranslateOptions
): string => i18n.t(`ServiceMessages.${key}`, options) as string;

export const getSpeechRecognitionLanguage = (): string => {
  const language = getCurrentAppLanguage();
  return language === 'zh' ? 'zh' : language;
};

export const getAiOutputLanguageInstruction = (): string =>
  translateServiceMessage('gemini.prompts.outputLanguageInstruction', {
    language: translateServiceMessage(
      `languages.${getCurrentAppLanguage()}`
    ),
  });
