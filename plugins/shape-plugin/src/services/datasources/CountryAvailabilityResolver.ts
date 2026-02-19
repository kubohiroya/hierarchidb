import { metadataLoader } from '../metadata/MetadataLoader';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName } from '../../common/types/index';
import { defaultDataSourceFactory } from './DataSourceStrategyFactory.js';
import { resolveStrategyIdFromDataSource } from './strategyIds.js';
import { SHAPE_DATA_SOURCE_BY_NAME } from '../../common/types/constants';

type AvailabilitySource = 'strategy' | 'metadata' | 'none';

export type CountryAvailabilityMatrix = {
  dataSource: DataSourceName;
  availableAdminLevels: Map<string, number[]>;
  maxAdminLevel: number;
  source: AvailabilitySource;
};

type StrategyAvailabilityProvider = {
  getAvailableCountries?: () => Promise<string[]>;
  getAvailableAdminLevels?: (country: string) => Promise<Array<string | number>>;
};

const STRATEGY_ADMIN_LEVEL_FETCH_CONCURRENCY = 8;

const normalizeLevels = (levels: Array<string | number> | undefined | null): number[] => {
  if (!levels) return [];
  const resolved = levels
    .map((value) => {
      if (typeof value === 'number') return value;
      const match = typeof value === 'string' ? value.match(/(\d+)/) : null;
      if (!match) return Number.NaN;
      return Number.parseInt(match[1] ?? '', 10);
    })
    .filter((value): value is number => Number.isFinite(value) && value >= 0);
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

const buildAvailabilityFromMetadata = async (
  dataSource: DataSourceName,
  nodeId: NodeId,
): Promise<CountryAvailabilityMatrix> => {
  const metadata = await metadataLoader.loadMetadata(dataSource, nodeId);
  const entries = new Map<string, number[]>();
  metadata.forEach((country) => {
    const code = (country.iso3 ?? country.countryCode ?? country.iso2 ?? '').toUpperCase();
    const levels = normalizeLevels(country.availableAdminLevels);
    if (code) {
      entries.set(code, levels);
    }
  });
  const fallbackMax = SHAPE_DATA_SOURCE_BY_NAME[dataSource]?.maxAdminLevel ?? 0;
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

const fetchAvailabilityFromStrategy = async (dataSource: DataSourceName): Promise<CountryAvailabilityMatrix | null> => {
  const strategyId = resolveStrategyIdFromDataSource(dataSource);
  if (!strategyId) return null;
  const strategy = defaultDataSourceFactory.create(strategyId) as StrategyAvailabilityProvider;
  if (!strategy.getAvailableCountries || !strategy.getAvailableAdminLevels) {
    return null;
  }
  const getAvailableAdminLevels = strategy.getAvailableAdminLevels;

  const countries = await strategy.getAvailableCountries();
  const entries = new Map<string, number[]>();
  for (let offset = 0; offset < countries.length; offset += STRATEGY_ADMIN_LEVEL_FETCH_CONCURRENCY) {
    const chunk = countries.slice(offset, offset + STRATEGY_ADMIN_LEVEL_FETCH_CONCURRENCY);
    const resolvedChunk = await Promise.all(chunk.map(async (country) => {
      try {
        const levelsRaw = await getAvailableAdminLevels(country);
        const levels = normalizeLevels(levelsRaw);
        return { country, levels };
      } catch (error) {
        console.warn('[CountryAvailabilityResolver] failed to load levels for country', country, error);
        return null;
      }
    }));
    resolvedChunk.forEach((entry) => {
      if (!entry) return;
      const key = entry.country.trim().toUpperCase();
      if (key && entry.levels.length > 0) {
        entries.set(key, entry.levels);
      }
    });
  }

  if (entries.size === 0) {
    return null;
  }

  const fallbackMax = SHAPE_DATA_SOURCE_BY_NAME[dataSource]?.maxAdminLevel ?? 0;
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

export const fetchCountryAvailability = async (
  dataSource: DataSourceName,
  nodeId: NodeId,
): Promise<CountryAvailabilityMatrix> => {
  const strategyAvailability = await fetchAvailabilityFromStrategy(dataSource).catch((error) => {
    console.warn('[CountryAvailabilityResolver] strategy availability failed', { dataSource, error });
    return null;
  });
  if (strategyAvailability) {
    return strategyAvailability;
  }
  return buildAvailabilityFromMetadata(dataSource, nodeId);
};
