/**
 * Shape plugin shared utilities
 * Pure functions that can be used in both UI and Worker environments
 */

import type {
  CountryMetadata,
  DataSourceName,
  // ShapeEntity,
  FetchTaskPayload,
  ShapeStepValidationResult,
  SelectedArrayByCountries
} from '../../common/types/index.js';
import { SHAPE_DATA_SOURCES, DEFAULT_BUILD_CONFIG } from '../../common/types/constants.js';
import { GEOBOUNDARIES_RELEASE_BASE_URL } from './geoboundariesEndpoints.js';
import type { ShapeBuildConfig } from '../../common/types/index.js';

const KNOWN_DATA_SOURCE_NAMES = new Set<DataSourceName>(
  SHAPE_DATA_SOURCES.map((source) => source.name),
);
/*
const stripNil = <T extends object>(value?: T | null): Partial<T> => {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined),
  ) as Partial<T>;
};
 */

export function normalizeDataSourceName(value?: string | null): DataSourceName | undefined {
  if (typeof value !== 'string') return undefined;
  return KNOWN_DATA_SOURCE_NAMES.has(value as DataSourceName)
    ? (value as DataSourceName)
    : undefined;
}

export function getDataSourceConfig(dataSource?: string | null) {
  const normalized = normalizeDataSourceName(dataSource);
  if (!normalized) return undefined;
  return SHAPE_DATA_SOURCES.find((source) => source.name === normalized);
}

export function getPreferredCountryCodeFormat(dataSource?: string | null): 'iso2' | 'iso3' {
  return getDataSourceConfig(dataSource)?.countryCodeFormat ?? 'iso2';
}

export function resolveCountryCodeForDataSource(
  dataSource: DataSourceName,
  country: Partial<CountryMetadata>,
  fallback?: string,
): string {
  const preferred = getPreferredCountryCodeFormat(dataSource);
  const byFormat = preferred === 'iso3' ? country.iso3 : country.iso2;
  const candidate = (byFormat ?? country.countryCode ?? fallback ?? '')
    .trim()
    .toUpperCase();
  if (!candidate) return fallback?.trim().toUpperCase() || '';
  if (preferred === 'iso2' && candidate.length === 3 && country.iso2) {
    return country.iso2.trim().toUpperCase();
  }
  if (preferred === 'iso3' && candidate.length === 2 && country.iso3) {
    return country.iso3.trim().toUpperCase();
  }
  return candidate;
}

/*

type ShapeDraft = {
  draftData: ShapeEntity;
};

export function createDraftFromEntity(entity: ShapeEntity): ShapeDraft {
  const normalizedDataSourceName =
    normalizeDataSourceName(entity.buildConfig?.dataSource)
    ?? entity.buildConfig?.dataSource;
  return {
    draftData: {
      ...entity,
      buildConfig: {
        ...entity.buildConfig,
        dataSource: normalizedDataSourceName,
      },
    },
  };
}

export function mapDraftToUpdates(draft: ShapeDraft): Partial<ShapeEntity> {
  const draftData = draft.draftData;
  const normalizedDataSourceName =
    normalizeDataSourceName(draftData.buildConfig?.dataSource)
    ?? draftData.buildConfig?.dataSource;
  return {
    ...draftData,
    buildConfig: {
      ...draftData.buildConfig,
      dataSource: normalizedDataSourceName,
    },
  };
}
 */

/**
 * Validate processing configuration
 */
export function validateBatchConfig(config: Partial<ShapeBuildConfig>): ShapeStepValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalized = mergeBuildConfig(config);
  const transformByBandConcurrentProcesses = normalized.transformByBandConfig?.concurrentProcesses;
  const transformByZoomConcurrentProcesses = normalized.transformByZoomConfig?.concurrentProcesses;

  const fetchConcurrency = normalized.fetchConfig?.concurrentDownloads;
  if (fetchConcurrency !== undefined) {
    if (fetchConcurrency < 1 || fetchConcurrency > 4) {
      errors.push('Concurrent downloads must be between 1 and 4');
    }
  }

  if (transformByBandConcurrentProcesses !== undefined) {
    if (transformByBandConcurrentProcesses < 1 || transformByBandConcurrentProcesses > 8) {
      errors.push('Concurrent by-band processes must be between 1 and 8');
    }
  }
  if (transformByZoomConcurrentProcesses !== undefined) {
    if (transformByZoomConcurrentProcesses < 1 || transformByZoomConcurrentProcesses > 8) {
      errors.push('Concurrent by-zoom processes must be between 1 and 8');
    }
  }

  const areaThreshold = normalized.transformByBandConfig?.featureAreaThreshold;
  if (areaThreshold !== undefined) {
    if (areaThreshold < 0 || areaThreshold > 10000) {
      errors.push('Feature area threshold must be between 0 and 10000');
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Calculate selection statistics from URL metadata
 */
const normalizeCountryCodeFromMetadata = (country: Partial<CountryMetadata>, index: number): string => {
  const iso2 = country.iso2?.trim();
  if (iso2) return iso2.toUpperCase();
  const countryCode = country.countryCode?.trim();
  if (countryCode) return countryCode.toUpperCase();
  return `COUNTRY-${index}`;
};

const resolveSelectedLevels = (row?: boolean[]): number[] => {
  if (!row) return [];
  return row
    .map((checked, levelIndex) => (checked ? levelIndex : null))
    .filter((level): level is number => typeof level === 'number');
};

/**
 * Generate download task payloads for selected countries and admin levels
 */
export function generateDownloadTaskPayloads(
  dataSource: DataSourceName,
  countries: string[],
  adminLevels: number[],
  countryMetadata: CountryMetadata[],
): FetchTaskPayload[] {
  const payloads: FetchTaskPayload[] = [];
  const countryMap = new Map<string, CountryMetadata>();
  countryMetadata.forEach((country) => {
    const add = (code?: string) => {
      if (!code) return;
      countryMap.set(code.trim().toUpperCase(), country);
    };
    add(country.countryCode);
    add(country.iso2);
    add(country.iso3);
  });

  countries.forEach((countryCode) => {
    const country = countryMap.get(countryCode.trim().toUpperCase());
    if (!country) return;

    adminLevels.forEach((level) => {
      if (!country.availableAdminLevels.includes(level)) return;

      const resolvedCode = resolveCountryCodeForDataSource(dataSource, country, countryCode);
      if (!resolvedCode) {
        throw new Error(`[shape-plugin] Failed to resolve country code for ${dataSource} (${countryCode})`);
      }
      const url = buildDataSourceUrl(dataSource, resolvedCode, level);
      if (url) {
        payloads.push({
          url,
          countryCode: resolvedCode,
          countryName: country.countryName,
          adminLevel: level,
          dataSource,
        });
      }
    });
  });

  return payloads;
}

/**
 * Generate download task payloads for selected countries and admin levels by matrix selection.
 */
export function generateDownloadTaskPayloadsFromSelection(
  dataSource: DataSourceName,
  selectedArrayByCountries: SelectedArrayByCountries | undefined,
  countryMetadata: CountryMetadata[],
): FetchTaskPayload[] {
  if (!selectedArrayByCountries || !Object.keys(selectedArrayByCountries).length || !countryMetadata.length) {
    return [];
  }
  const iso3ToIso2 = new Map(
    countryMetadata
      .map((country) => {
        const iso3 = country.iso3?.trim().toUpperCase();
        const iso2 = country.iso2?.trim().toUpperCase() ?? country.countryCode?.trim().toUpperCase();
        if (!iso3 || !iso2) return null;
        return [iso3, iso2] as const;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
  const selectionByIso2 = new Map<string, boolean[]>();
  Object.entries(selectedArrayByCountries).forEach(([key, row]) => {
    const normalizedKey = key.trim().toUpperCase();
    const iso2Key = normalizedKey.length === 2
      ? normalizedKey
      : iso3ToIso2.get(normalizedKey);
    if (iso2Key) {
      selectionByIso2.set(iso2Key, row);
    }
  });
  return countryMetadata.flatMap((country, index) => {
    const normalizedCode = normalizeCountryCodeFromMetadata(country, index);
    const iso2Key = normalizedCode.trim().toUpperCase();
    const selectedRow = selectionByIso2.get(iso2Key);
    const selectedLevels = resolveSelectedLevels(selectedRow);
    if (selectedLevels.length === 0) return [];
    return selectedLevels.flatMap((level) => {
      if (!country.availableAdminLevels.includes(level)) return [];
      const resolvedCode = resolveCountryCodeForDataSource(dataSource, country, normalizedCode);
      if (!resolvedCode) {
        throw new Error(`[shape-plugin] Failed to resolve country code for ${dataSource} (${normalizedCode})`);
      }
      const url = buildDataSourceUrl(dataSource, resolvedCode, level);
      if (!url) return [];
      return [{
        url,
        countryCode: resolvedCode,
        countryName: country.countryName,
        adminLevel: level,
        dataSource,
      }];
    });
  });
}

export const buildFetchTaskId = (nodeId: string, payload: FetchTaskPayload): string => {
  const countryId = payload.countryCode.trim();
  if (!countryId) {
    throw new Error(`[shape-plugin] DownloadTaskPayload.countryCode is required (${nodeId})`);
  }
  return `${nodeId}+${countryId}+${payload.adminLevel}`;
};

/**
 * Build data source URL for specific country and admin level
 */
function buildDataSourceUrl(
  dataSource: DataSourceName,
  countryCode: string,
  adminLevel: number,
): string | null {
  const baseUrls = {
    naturalearth: 'https://www.naturalearthdata.com/download',
    geoboundaries: GEOBOUNDARIES_RELEASE_BASE_URL,
    gadm: 'https://geodata.ucdavis.edu/gadm/gadm4.1',
    openstreetmap: 'https://download.geofabrik.de',
  } as const;

  const baseUrl = baseUrls[dataSource];
  if (!baseUrl) return null;

  switch (dataSource) {
    case 'naturalearth': {
      // Prefer 50m scale; adminLevel 0 -> countries, 1 -> states/provinces
      const scale = '50m';
      const file = adminLevel === 0
        ? 'ne_50m_admin_0_countries.zip'
        : 'ne_50m_admin_1_states_provinces.zip';
      return `${baseUrl}/${scale}/cultural/${file}`;
    }
    case 'geoboundaries':
      return `${baseUrl}/${countryCode}/ADM${adminLevel}`;
    case 'gadm':
      return adminLevel === 0
        ? `${baseUrl}/json/gadm41_${countryCode.toUpperCase()}_${adminLevel}.json`
        : `${baseUrl}/json/gadm41_${countryCode.toUpperCase()}_${adminLevel}.json.zip`;
    case 'openstreetmap':
      return `${baseUrl}/${countryCode.toLowerCase()}-latest.osm.pbf`;
    default:
      return null;
  }
}

/**
 * Estimate data size based on country and admin level
 */
/**
 * Merge processing config with defaults
 */
export function mergeBuildConfig(config: Partial<ShapeBuildConfig>): ShapeBuildConfig {
  return {
    dataSourceName: config.dataSourceName ?? DEFAULT_BUILD_CONFIG.dataSourceName,
    fetchConfig: {
      ...DEFAULT_BUILD_CONFIG.fetchConfig,
      ...config.fetchConfig,
    },
    transformByBandConfig: {
      ...DEFAULT_BUILD_CONFIG.transformByBandConfig,
      ...config.transformByBandConfig,
    },
    transformByZoomConfig: {
      ...DEFAULT_BUILD_CONFIG.transformByZoomConfig,
      ...config.transformByZoomConfig,
    },
    vtConfig: {
      ...DEFAULT_BUILD_CONFIG.vtConfig,
      ...config.vtConfig,
    },
    cleanupConfig: {
      ...(DEFAULT_BUILD_CONFIG.cleanupConfig ?? {}),
      ...(config.cleanupConfig ?? {}),
    },
  };
}

/**
 * Summarize checkbox atoms into simple derived information.
 */
export function summarizeCheckboxState(state: SelectedArrayByCountries | undefined): {
  hasSelection: boolean;
  levels: number[];
  selectedRowCount: number;
  totalSelections: number;
} {
  const matrix = Object.values(state ?? {}) as boolean[][];

  let hasSelection = false;
  const levelSet = new Set<number>();
  let selectedRowCount = 0;
  let totalSelections = 0;

  matrix.forEach((row) => {
    let rowSelected = false;
    row.forEach((selected, levelIndex) => {
      if (selected) {
        hasSelection = true;
        levelSet.add(levelIndex);
        rowSelected = true;
        totalSelections += 1;
      }
    });
    if (rowSelected) {
      selectedRowCount += 1;
    }
  });

  return {
    hasSelection,
    levels: Array.from(levelSet).sort((a, b) => a - b),
    selectedRowCount,
    totalSelections,
  };
}
