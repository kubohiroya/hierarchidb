declare module 'provider-i18next' {
  export function useTranslation(ns?: string): {
    t: (key: string, defaultText?: string, options?: any) => string;
  };
}

