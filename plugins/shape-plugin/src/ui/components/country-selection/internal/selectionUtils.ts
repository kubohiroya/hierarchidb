import type { ContinentCode } from '@hierarchidb/ui-country-select';
import type { CountryMetadata } from '../../../../common/types/index.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { SerializedCountryAvailability } from '../../../workers/countryAvailability.types.js';

export const CONTINENT_CODES: ContinentCode[] = ['AF', 'AS', 'EU', 'NA', 'SA', 'OC', 'AN', 'XX'];

const CONTINENT_ALIASES: Record<string, ContinentCode> = {
  africa: 'AF',
  af: 'AF',
  asia: 'AS',
  as: 'AS',
  europe: 'EU',
  eu: 'EU',
  'north america': 'NA',
  na: 'NA',
  'south america': 'SA',
  sa: 'SA',
  'central america': 'NA',
  oceania: 'OC',
  australia: 'OC',
  oc: 'OC',
  antarctica: 'AN',
  an: 'AN',
};

const isContinentCode = (value: string): value is ContinentCode => CONTINENT_CODES.includes(value as ContinentCode);

export const normalizeContinentCode = (continent?: string): ContinentCode | undefined => {
  if (!continent) return undefined;
  const trimmed = continent.trim();
  if (!trimmed) return undefined;
  const alias = CONTINENT_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const upper = trimmed.toUpperCase();
  if (isContinentCode(upper)) return upper;
  return undefined;
};

export const normalizeCountryCodeFromMetadata = (country: Partial<CountryMetadata>, index: number): string => {
  const iso2 = country.iso2?.trim();
  if (iso2) return iso2.toUpperCase();
  const countryCode = country.countryCode?.trim();
  if (countryCode) return countryCode.toUpperCase();
  const iso3 = country.iso3?.trim();
  if (iso3) return iso3.toUpperCase();
  return `COUNTRY-${index}`;
};

export const isSelectionEqual = (
  left?: Record<string, boolean[]>,
  right?: Record<string, boolean[]>,
): boolean => {
  if (!left || !right) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let i = 0; i < leftKeys.length; i += 1) {
    if (leftKeys[i] !== rightKeys[i]) return false;
  }
  return leftKeys.every((key) => {
    const leftRow = left[key] ?? [];
    const rightRow = right[key] ?? [];
    if (leftRow.length !== rightRow.length) return false;
    for (let colIndex = 0; colIndex < leftRow.length; colIndex += 1) {
      if (Boolean(leftRow[colIndex]) !== Boolean(rightRow[colIndex])) return false;
    }
    return true;
  });
};

export const buildSelectionSet = (selection: Record<string, boolean[]>): Set<string> => {
  const set = new Set<string>();
  Object.entries(selection).forEach(([code, row]) => {
    row.forEach((selected, index) => {
      if (selected) {
        set.add(`${code}:${index}`);
      }
    });
  });
  return set;
};

export type CountrySelectionBootstrapCacheEntry = {
  countries: Array<CountryMetadata>;
  availability: SerializedCountryAvailability | null;
  fetchedAt: number;
};

export const countrySelectionBootstrapCache = new Map<string, CountrySelectionBootstrapCacheEntry>();

export const buildBootstrapCacheKey = (nodeId: NodeId, dataSourceKey: string): string => (
  `${String(nodeId)}:${dataSourceKey}`
);
