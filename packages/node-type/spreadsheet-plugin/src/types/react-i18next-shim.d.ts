declare module 'react-i18next' {
  export function useTranslation(ns?: string | string[]): {
    t: (key: string, defaultValue?: string) => string;
  };
}

