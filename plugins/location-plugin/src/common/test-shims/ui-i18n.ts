type TranslationOptions = { defaultValue?: string; ns?: string };

export const i18n = {
  language: 'en',
  t: (key: string, options?: TranslationOptions) => options?.defaultValue ?? key,
};
