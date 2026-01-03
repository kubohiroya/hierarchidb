import { metadataLoader } from '../metadata/MetadataLoader.js';
import { normalizeDataSourceName } from '../utils/utils.js';
import { defaultDataSourceFactory } from './DataSourceStrategyFactory.js';
import { resolveStrategyIdFromDataSource } from './strategyIds.js';
import { DATA_SOURCE_CONFIGS } from '../../common/mock/data.js';

type AvailabilitySource = 'strategy' | 'metadata' | 'none';

export type CountryAvailabilityMatrix = {
  dataSource: string;
  availableAdminLevels: Map<string, number[]>;
  maxAdminLevel: number;
  source: AvailabilitySource;
};

type StrategyAvailabilityProvider = {
  getAvailableCountries?: () => Promise<string[]>;
  getAvailableAdminLevels?: (country: string) => Promise<Array<string | number>>;
};

const normalizeLevels = (levels: Array<string | number> | undefined | null): number[] => {
  if (!levels) return [];
  const resolved = levels
    .map((value) => {
      if (typeof value === 'number') return value;
      const match = typeof value === 'string' ? value.match(/(\d+)/) : null;
      if (!match) return Number.NaN;
      return Number.parseInt(match[1] ?? '', 10);
    })
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Number(value));
  return Array.from(new Set(resolved)).sort((a, b) => a - b);
};

const toMaxAdminLevel = (levels: Iterable<number>): number => {
  let max = 0;
  for (const level of levels) {
    if (Number.isFinite(level)) {
      max = Math.max(max, level);
    }
  }
  return max;
};

const buildAvailabilityFromMetadata = async (dataSource: string): Promise<CountryAvailabilityMatrix> => {
  const metadata = await metadataLoader.loadMetadata(dataSource);
  const entries = new Map<string, number[]>();
  metadata.forEach((country) => {
    const code = (country.iso3 ?? country.countryCode ?? country.iso2 ?? '').toUpperCase();
    const levels = normalizeLevels(country.availableAdminLevels);
    if (code) {
      entries.set(code, levels);
    }
  });
  const fallbackMax = DATA_SOURCE_CONFIGS[dataSource]?.maxAdminLevel ?? 0;
  const maxAdminLevel = Math.max(
    fallbackMax,
    toMaxAdminLevel(Array.from(entries.values()).flat()),
  );
  return {
    dataSource,
    availableAdminLevels: entries,
    maxAdminLevel,
    source: entries.size > 0 ? 'metadata' : 'none',
  };
};

const fetchAvailabilityFromStrategy = async (dataSource: string): Promise<CountryAvailabilityMatrix | null> => {
  const strategyId = resolveStrategyIdFromDataSource(dataSource);
  if (!strategyId) return null;
  const strategy = defaultDataSourceFactory.create(strategyId) as StrategyAvailabilityProvider;
  if (!strategy.getAvailableCountries || !strategy.getAvailableAdminLevels) {
    return null;
  }

  const countries = await strategy.getAvailableCountries();
  const entries = new Map<string, number[]>();
  for (const country of countries) {
    try {
      const levelsRaw = await strategy.getAvailableAdminLevels(country);
      const levels = normalizeLevels(levelsRaw);
      const key = country.trim().toUpperCase();
      if (key && levels.length > 0) {
        entries.set(key, levels);
      }
    } catch (error) {
      console.warn('[CountryAvailabilityResolver] failed to load levels for country', country, error);
    }
  }

  if (entries.size === 0) {
    return null;
  }

  const fallbackMax = DATA_SOURCE_CONFIGS[dataSource]?.maxAdminLevel ?? 0;
  const maxAdminLevel = Math.max(
    fallbackMax,
    toMaxAdminLevel(Array.from(entries.values()).flat()),
  );

  return {
    dataSource,
    availableAdminLevels: entries,
    maxAdminLevel,
    source: 'strategy',
  };
};

export const fetchCountryAvailability = async (dataSource: string): Promise<CountryAvailabilityMatrix> => {
  const normalized = normalizeDataSourceName(dataSource ?? '') ?? 'naturalearth';
  if (normalized === 'openstreetmap') {
    throw new Error('OpenStreetMap is not supported in Step3 country selection.');
  }
  const strategyAvailability = await fetchAvailabilityFromStrategy(normalized).catch((error) => {
    console.warn('[CountryAvailabilityResolver] strategy availability failed', { normalized, error });
    return null;
  });
  if (strategyAvailability) {
    return strategyAvailability;
  }
  return buildAvailabilityFromMetadata(normalized);
};
