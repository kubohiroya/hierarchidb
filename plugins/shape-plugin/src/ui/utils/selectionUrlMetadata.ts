import type { CountryMetadata, UrlMetadata } from '../../common/types/index.js';
import { generateUrlMetadata, normalizeDataSourceName } from '../../services/utils/utils.js';

const normalizeCountryCodeFromMetadata = (country: Partial<CountryMetadata>, index: number): string => {
  const candidates = [country.countryCode, country.iso2, country.iso3].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  const primary = (candidates[0] ?? `country-${index}`).trim().toUpperCase();
  if (primary.length === 2) return primary;
  if (primary.length === 3 && country.iso2) return country.iso2.trim().toUpperCase();
  if (primary.length === 3) return primary.slice(0, 2);
  return primary.slice(0, 2) || `COUNTRY-${index}`;
};

const normalizeMetadata = (metadata: CountryMetadata[]): CountryMetadata[] =>
  metadata.map((country, index) => ({
    ...country,
    countryCode: normalizeCountryCodeFromMetadata(country, index),
    availableAdminLevels: country.availableAdminLevels ?? [],
  }));

const resolveSelectedLevels = (row?: boolean[]): number[] => {
  if (!row) return [];
  return row
    .map((checked, levelIndex) => (checked ? levelIndex : null))
    .filter((level): level is number => typeof level === 'number');
};

export function deriveUrlMetadataFromSelection(params: {
  dataSource?: string | null;
  dataSourceName?: string | null;
  selectedArrayByCountries?: boolean[][] | string;
  metadata: CountryMetadata[];
}): UrlMetadata[] {
  const { dataSource, dataSourceName, selectedArrayByCountries, metadata } = params;
  if (!Array.isArray(selectedArrayByCountries)) return [];
  if (!metadata.length) return [];
  const resolvedDataSource = normalizeDataSourceName(dataSource ?? dataSourceName ?? null);
  if (!resolvedDataSource) return [];
  const normalizedMetadata = normalizeMetadata(metadata);

  return normalizedMetadata.flatMap((country, index) => {
    const selectedLevels = resolveSelectedLevels(selectedArrayByCountries[index]);
    if (selectedLevels.length === 0) return [];
    return generateUrlMetadata(resolvedDataSource, [country.countryCode], selectedLevels, normalizedMetadata);
  });
}
