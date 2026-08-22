const translate = (key: string, defaultValue?: string) => defaultValue ?? key;

export const i18n = {
  language: 'en',
  addResourceBundle: () => undefined,
  changeLanguage: async () => undefined,
  exists: () => true,
  t: translate,
};

export function useTranslation() {
  return {
    t: translate,
    i18n,
  };
}
