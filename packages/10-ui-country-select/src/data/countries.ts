/**
 * @fileoverview Sample countries data for development and testing
 * @module @hierarchidb/ui-country-select/data
 */

import type { Country } from '../types/Country';

/** Sample countries data (subset for demonstration) */
export const SAMPLE_COUNTRIES: Country[] = [
  {
    code: 'US',
    name: 'United States',
    nativeName: 'United States',
    continent: 'NA',
    population: 331900000,
    area: 9833520,
    capital: 'Washington, D.C.',
    currency: 'USD',
    flag: '🇺🇸',
  },
  {
    code: 'CA',
    name: 'Canada',
    nativeName: 'Canada',
    continent: 'NA',
    population: 38000000,
    area: 9984670,
    capital: 'Ottawa',
    currency: 'CAD',
    flag: '🇨🇦',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    nativeName: 'United Kingdom',
    continent: 'EU',
    population: 67000000,
    area: 243610,
    capital: 'London',
    currency: 'GBP',
    flag: '🇬🇧',
  },
  {
    code: 'DE',
    name: 'Germany',
    nativeName: 'Deutschland',
    continent: 'EU',
    population: 83000000,
    area: 357114,
    capital: 'Berlin',
    currency: 'EUR',
    flag: '🇩🇪',
  },
  {
    code: 'FR',
    name: 'France',
    nativeName: 'France',
    continent: 'EU',
    population: 68000000,
    area: 643801,
    capital: 'Paris',
    currency: 'EUR',
    flag: '🇫🇷',
  },
  {
    code: 'JP',
    name: 'Japan',
    nativeName: '日本',
    continent: 'AS',
    population: 125000000,
    area: 377975,
    capital: 'Tokyo',
    currency: 'JPY',
    flag: '🇯🇵',
  },
  {
    code: 'CN',
    name: 'China',
    nativeName: '中国',
    continent: 'AS',
    population: 1440000000,
    area: 9596960,
    capital: 'Beijing',
    currency: 'CNY',
    flag: '🇨🇳',
  },
  {
    code: 'IN',
    name: 'India',
    nativeName: 'भारत',
    continent: 'AS',
    population: 1380000000,
    area: 3287263,
    capital: 'New Delhi',
    currency: 'INR',
    flag: '🇮🇳',
  },
  {
    code: 'AU',
    name: 'Australia',
    nativeName: 'Australia',
    continent: 'OC',
    population: 26000000,
    area: 7692024,
    capital: 'Canberra',
    currency: 'AUD',
    flag: '🇦🇺',
  },
  {
    code: 'BR',
    name: 'Brazil',
    nativeName: 'Brasil',
    continent: 'SA',
    population: 215000000,
    area: 8514877,
    capital: 'Brasília',
    currency: 'BRL',
    flag: '🇧🇷',
  },
  {
    code: 'MX',
    name: 'Mexico',
    nativeName: 'México',
    continent: 'NA',
    population: 130000000,
    area: 1964375,
    capital: 'Mexico City',
    currency: 'MXN',
    flag: '🇲🇽',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    nativeName: 'South Africa',
    continent: 'AF',
    population: 60000000,
    area: 1221037,
    capital: 'Cape Town',
    currency: 'ZAR',
    flag: '🇿🇦',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    nativeName: 'Nigeria',
    continent: 'AF',
    population: 220000000,
    area: 923768,
    capital: 'Abuja',
    currency: 'NGN',
    flag: '🇳🇬',
  },
  {
    code: 'EG',
    name: 'Egypt',
    nativeName: 'مصر',
    continent: 'AF',
    population: 104000000,
    area: 1001449,
    capital: 'Cairo',
    currency: 'EGP',
    flag: '🇪🇬',
  },
  {
    code: 'RU',
    name: 'Russia',
    nativeName: 'Россия',
    continent: 'EU',
    population: 146000000,
    area: 17098242,
    capital: 'Moscow',
    currency: 'RUB',
    flag: '🇷🇺',
  },
];

/** Get countries filtered by continent */
export function getCountriesByContinent(continent?: string): Country[] {
  if (!continent) return SAMPLE_COUNTRIES;
  return SAMPLE_COUNTRIES.filter(country => country.continent === continent);
}

/** Get country by code */
export function getCountryByCode(code: string): Country | undefined {
  return SAMPLE_COUNTRIES.find(country => country.code === code);
}

/** Search countries by name */
export function searchCountries(query: string): Country[] {
  const lowercaseQuery = query.toLowerCase();
  return SAMPLE_COUNTRIES.filter(country => 
    country.name.toLowerCase().includes(lowercaseQuery) ||
    (country.nativeName && country.nativeName.toLowerCase().includes(lowercaseQuery))
  );
}