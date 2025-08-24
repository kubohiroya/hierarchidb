/**
 * @fileoverview Country and region types for country selection components
 * @module @hierarchidb/ui-country-select/types
 */

export interface Country {
  /** ISO 3166-1 alpha-2 country code */
  code: string;
  /** Country name in English */
  name: string;
  /** Country name in native language (optional) */
  nativeName?: string;
  /** Continent code */
  continent: ContinentCode;
  /** Population (optional) */
  population?: number;
  /** Area in km² (optional) */
  area?: number;
  /** Capital city (optional) */
  capital?: string;
  /** Currency code (optional) */
  currency?: string;
  /** Flag emoji (optional) */
  flag?: string;
}

export type ContinentCode = 'AF' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC' | 'AN';

export interface Continent {
  code: ContinentCode;
  name: string;
}

export const CONTINENTS: Record<ContinentCode, Continent> = {
  AF: { code: 'AF', name: 'Africa' },
  AS: { code: 'AS', name: 'Asia' },
  EU: { code: 'EU', name: 'Europe' },
  NA: { code: 'NA', name: 'North America' },
  SA: { code: 'SA', name: 'South America' },
  OC: { code: 'OC', name: 'Oceania' },
  AN: { code: 'AN', name: 'Antarctica' },
};

/** Selection state for a country */
export interface CountrySelection {
  country: Country;
  /** Matrix selections for this country */
  matrixSelections: Record<string, boolean>;
}

/** Country filter options */
export interface CountryFilter {
  /** Search query for country name */
  searchQuery?: string;
  /** Filter by continent */
  continent?: ContinentCode;
  /** Filter by minimum population */
  minPopulation?: number;
  /** Filter by maximum population */
  maxPopulation?: number;
  /** Custom filter function */
  customFilter?: (country: Country) => boolean;
}