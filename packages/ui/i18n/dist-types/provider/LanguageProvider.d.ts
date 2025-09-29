/**
 * Language Provider Component
 *
 * This component provides language switching functionality and integrates
 * with the Material-UI theme system for locale-aware formatting.
 */
import { type ReactNode } from 'react';
import '../i18n/index.js';
type Locale = unknown;
export interface LanguageConfig {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    direction: 'ltr' | 'rtl';
    dateLocale: Locale;
}
export declare const SUPPORTED_LANGUAGES: LanguageConfig[];
interface LanguageContextType {
    currentLanguage: LanguageConfig;
    supportedLanguages: LanguageConfig[];
    changeLanguage: (languageCode: string) => Promise<void>;
    isLoading: boolean;
    formatters: {
        number: Intl.NumberFormat;
        currency: Intl.NumberFormat;
        date: Intl.DateTimeFormat;
        time: Intl.DateTimeFormat;
        relativeTime: Intl.RelativeTimeFormat;
    };
}
export declare const useLanguage: () => LanguageContextType;
interface LanguageProviderProps {
    children: ReactNode;
}
export declare const LanguageProvider: React.FC<LanguageProviderProps>;
export declare const detectUserLanguage: () => string;
export {};
//# sourceMappingURL=LanguageProvider.d.ts.map