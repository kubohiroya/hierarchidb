declare module 'i18next' {
  export type TFunction = (key: string, defaultValue?: string) => string;
  export interface i18n { t: TFunction }
  const i18nInstance: i18n;
  export default i18nInstance;
}

