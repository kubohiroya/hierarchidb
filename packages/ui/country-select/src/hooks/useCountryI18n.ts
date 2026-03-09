/**
 * @fileoverview Hook for internationalized country names using ISO-3166-2 dictionary
 * @module @hierarchidb/ui-country-select/hooks
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  ensureIso3166CountryNamesI18n,
  getLocalizedCountryName,
} from '@hierarchidb/gen-iso3166-2/browser';
import type { Country } from '~/types/Country';

export interface UseCountryI18nResult {
  /** Get localized country name for a country code */
  getLocalizedName: (countryCode: string) => string;
  /** Get localized country name for a Country object */
  getCountryDisplayName: (country: Country) => string;
  /** Whether the i18n dictionary is ready */
  isReady: boolean;
  /** Current locale */
  locale: string;
}

/**
 * Hook for getting internationalized country names using ISO-3166-2 dictionary
 * 
 * This hook integrates with the existing i18n system and provides localized
 * country names with proper fallback mechanisms.
 */
export const useCountryI18n = (): UseCountryI18nResult => {
  const { i18n } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const locale = i18n.language;

  // Initialize ISO-3166-2 country names dictionary
  useEffect(() => {
    let active = true;
    
    const initializeCountryNames = async () => {
      try {
        await ensureIso3166CountryNamesI18n();
        if (active) {
          setIsReady(true);
        }
      } catch (error) {
        console.warn('Failed to load ISO-3166-2 country names dictionary:', error);
        if (active) {
          setIsReady(false);
        }
      }
    };

    initializeCountryNames();
    
    return () => {
      active = false;
    };
  }, [locale]);

  const getLocalizedName = useCallback((countryCode: string): string => {
    if (!isReady || !countryCode) {
      return countryCode || '';
    }

    const localizedName = getLocalizedCountryName(countryCode, locale);
    return localizedName || countryCode;
  }, [isReady, locale]);

  const getCountryDisplayName = useCallback((country: Country): string => {
    if (!isReady) {
      // Fallback to existing name fields when dictionary is not ready
      return country.nativeName || country.name || country.code;
    }

    // Try to get localized name from ISO-3166-2 dictionary
    const localizedName = getLocalizedCountryName(country.code, locale);
    
    if (localizedName) {
      return localizedName;
    }

    // Fallback to existing name fields
    return country.nativeName || country.name || country.code;
  }, [isReady, locale]);

  return {
    getLocalizedName,
    getCountryDisplayName,
    isReady,
    locale,
  };
};