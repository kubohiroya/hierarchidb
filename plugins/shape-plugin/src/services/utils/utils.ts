/**
 * Shape plugin shared utilities
 * Pure functions that can be used in both UI and Worker environments
 */

import type {
  CountryMetadata,
  DataSourceName,
  ShapeEntity,
  FetchTaskPayload,
  ShapeStepValidationResult,
  SelectedArrayByCountries,
} from '../../common/types/index.js';
import {
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  SHAPE_DATA_SOURCES,
} from '../../common/types/constants.js';
import { GEOBOUNDARIES_RELEASE_BASE_URL } from './geoboundariesEndpoints.js';
import type {
  ShapeBuildConfig,
  ShapeProcessingConfig,
  ShapeRuntimeBuildConfig,
} from '../../common/types/index.js';
import {
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';

export function getDataSourceConfig(dataSource?: DataSourceName | null) {
  if (!dataSource) return undefined;
  return SHAPE_DATA_SOURCES.find((source) => source.name === dataSource);
}

export function getPreferredCountryCodeFormat(dataSource?: DataSourceName | null): 'iso2' | 'iso3' {
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

type ShapeDraft = {
  draftData: Partial<ShapeEntity>;
};

export function createDraftFromEntity(entity: ShapeEntity): ShapeDraft {
  const baseBuildConfig = entity.buildConfig;
  const baseProcessingConfig = entity.processingConfig;
  return {
    draftData: {
      ...entity,
      buildConfig: baseBuildConfig,
      processingConfig: baseProcessingConfig,
    },
  };
}

export function mapDraftToUpdates(draft: ShapeDraft): Partial<ShapeEntity> {
  const draftData = draft.draftData;
  const baseBuildConfig = draftData.buildConfig;
  const baseProcessingConfig = draftData.processingConfig;
  return {
    ...draftData,
    buildConfig: baseBuildConfig,
    processingConfig: baseProcessingConfig,
  };
}

/**
 * Validate processing configuration
 */
export function validateBatchConfig(
  buildConfig: ShapeBuildConfig,
  processingConfig?: ShapeProcessingConfig,
): ShapeStepValidationResult {
  const errors: string[] = [];

  const mergedBuildConfig = mergeBuildConfig(DEFAULT_BUILD_CONFIG, buildConfig);
  const mergedProcessingConfig = mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, processingConfig);
  const transformConfig = mergedBuildConfig.transformConfig;

  const fetchConcurrency = mergedProcessingConfig.fetch.maxConcurrent;
  if (fetchConcurrency < 1 || fetchConcurrency > 4) {
    errors.push('Concurrent downloads must be between 1 and 4');
  }

  const transformConcurrentProcesses = mergedProcessingConfig.transform.maxConcurrent;
  if (transformConcurrentProcesses < 1 || transformConcurrentProcesses > 8) {
    errors.push('Concurrent transform processes must be between 1 and 8');
  }

  const zoomBandBoundaries = transformConfig.zoomBandBoundaries;
  const zoomBandCount = Math.max(0, zoomBandBoundaries.length - 1);
  if (zoomBandCount < ZOOM_BAND_MIN_RANGES || zoomBandCount > ZOOM_BAND_MAX_RANGES) {
    errors.push(`Zoom band count must be between ${ZOOM_BAND_MIN_RANGES} and ${ZOOM_BAND_MAX_RANGES}`);
  }
  if (zoomBandBoundaries.length === 0) {
    errors.push('Zoom band boundaries must include at least the minimum zoom');
  } else {
    const first = zoomBandBoundaries[0];
    const last = zoomBandBoundaries[zoomBandBoundaries.length - 1];
    if (first !== ZOOM_BAND_MIN_ZOOM) {
      errors.push(`Zoom band boundaries must start at ${ZOOM_BAND_MIN_ZOOM}`);
    }
    if (last === undefined || last < ZOOM_BAND_MIN_ZOOM || last > ZOOM_BAND_MAX_ZOOM) {
      errors.push(`Zoom band max boundary must be between ${ZOOM_BAND_MIN_ZOOM} and ${ZOOM_BAND_MAX_ZOOM}`);
    }
  }
  if (zoomBandBoundaries.some((value) => value < ZOOM_BAND_MIN_ZOOM || value > ZOOM_BAND_MAX_ZOOM)) {
    errors.push(`Zoom band boundaries must be between ${ZOOM_BAND_MIN_ZOOM} and ${ZOOM_BAND_MAX_ZOOM}`);
  }
  for (let i = 1; i < zoomBandBoundaries.length; i += 1) {
    const current = zoomBandBoundaries[i];
    const previous = zoomBandBoundaries[i - 1];
    if (current === undefined || previous === undefined) continue;
    if (current <= previous) {
      errors.push('Zoom band boundaries must be strictly increasing');
      break;
    }
  }

  const areaThreshold = transformConfig.featureAreaThreshold;
  if (areaThreshold < 0 || areaThreshold > 10000) {
    errors.push('Feature area threshold must be between 0 and 10000');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: undefined,
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
  return `${nodeId}:download:${countryId}:${payload.adminLevel}`;
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
    'geoboundaries-topojson': GEOBOUNDARIES_RELEASE_BASE_URL,
    gadm: 'https://geodata.ucdavis.edu/gadm/gadm4.1',
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
    case 'geoboundaries-topojson':
      return `${baseUrl}/${countryCode}/ADM${adminLevel}`;
    case 'gadm':
      return adminLevel === 0
        ? `${baseUrl}/json/gadm41_${countryCode.toUpperCase()}_${adminLevel}.json`
        : `${baseUrl}/json/gadm41_${countryCode.toUpperCase()}_${adminLevel}.json.zip`;
    default:
      return null;
  }
}

/**
 * Estimate data size based on country and admin level
 */
/**
 * Merge build config updates
 */
export function mergeBuildConfig(
  base: ShapeBuildConfig,
  overrides?: Partial<ShapeBuildConfig>,
): ShapeBuildConfig {
  if (!overrides) return base;

  const fetchConfig = overrides.fetchConfig
    ? {
      ...base.fetchConfig,
      ...overrides.fetchConfig,
      geometryIntakeGuard: overrides.fetchConfig.geometryIntakeGuard
        ? {
          ...(base.fetchConfig.geometryIntakeGuard ?? {}),
          ...overrides.fetchConfig.geometryIntakeGuard,
        }
        : base.fetchConfig.geometryIntakeGuard,
    }
    : base.fetchConfig;

  const bandOverrides = overrides.transformConfig;
  const resolveOmitDetailsLevel = (
    level: unknown,
  ): ShapeBuildConfig['transformConfig']['omitDetailsConfig']['level'] => {
    if (level === undefined) {
      return base.transformConfig.omitDetailsConfig.level;
    }
    if (level === 'weak' || level === 'medium' || level === 'strong') {
      return level;
    }
    if (level === 'none') {
      return 'weak';
    }
    if (level === 'moderate') {
      return 'medium';
    }
    throw new Error(`unsupported omit-details level: ${String(level)}`);
  };
  const transformConfig = bandOverrides
    ? {
      ...base.transformConfig,
      ...bandOverrides,
      anomalyDetection: bandOverrides.anomalyDetection
        ? {
          ...(base.transformConfig.anomalyDetection ?? {}),
          ...bandOverrides.anomalyDetection,
          geojson: bandOverrides.anomalyDetection.geojson
            ? {
              ...(base.transformConfig.anomalyDetection?.geojson ?? {}),
              ...bandOverrides.anomalyDetection.geojson,
            }
            : base.transformConfig.anomalyDetection?.geojson,
          topojson: bandOverrides.anomalyDetection.topojson
            ? {
              ...(base.transformConfig.anomalyDetection?.topojson ?? {}),
              ...bandOverrides.anomalyDetection.topojson,
            }
            : base.transformConfig.anomalyDetection?.topojson,
        }
        : base.transformConfig.anomalyDetection,
      anomalyRetry: bandOverrides.anomalyRetry
        ? {
          ...(base.transformConfig.anomalyRetry ?? {}),
          ...bandOverrides.anomalyRetry,
        }
        : base.transformConfig.anomalyRetry,
      hybridFilterConfig: bandOverrides.hybridFilterConfig
        ? { ...base.transformConfig.hybridFilterConfig, ...bandOverrides.hybridFilterConfig }
        : base.transformConfig.hybridFilterConfig,
      omitDetailsConfig: bandOverrides.omitDetailsConfig
        ? {
          ...base.transformConfig.omitDetailsConfig,
          ...bandOverrides.omitDetailsConfig,
          level: resolveOmitDetailsLevel(bandOverrides.omitDetailsConfig.level),
        }
        : base.transformConfig.omitDetailsConfig,
    }
    : base.transformConfig;

  const vtConfig = overrides.vtConfig
    ? {
      ...base.vtConfig,
      ...overrides.vtConfig,
      outputQualityGuard: overrides.vtConfig.outputQualityGuard
        ? {
          ...(base.vtConfig.outputQualityGuard ?? {}),
          ...overrides.vtConfig.outputQualityGuard,
        }
        : base.vtConfig.outputQualityGuard,
    }
    : base.vtConfig;

  const cleanupConfig = overrides.cleanupConfig
    ? { ...(base.cleanupConfig ?? {}), ...overrides.cleanupConfig }
    : base.cleanupConfig;

  return {
    ...base,
    ...overrides,
    fetchConfig,
    transformConfig,
    vtConfig,
    cleanupConfig,
  };
}

export function mergeProcessingConfig(
  base: ShapeProcessingConfig,
  overrides?: Partial<ShapeProcessingConfig>,
): ShapeProcessingConfig {
  if (!overrides) return base;

  const fetch = overrides.fetch
    ? { ...base.fetch, ...overrides.fetch }
    : base.fetch;
  const transform = overrides.transform
    ? { ...base.transform, ...overrides.transform }
    : base.transform;
  const vt = overrides.vt
    ? {
      ...base.vt,
      ...overrides.vt,
      dynamicConcurrency: overrides.vt.dynamicConcurrency
        ? {
          ...(base.vt.dynamicConcurrency ?? {}),
          ...overrides.vt.dynamicConcurrency,
        }
        : base.vt.dynamicConcurrency,
    }
    : base.vt;

  return {
    ...base,
    ...overrides,
    fetch,
    transform,
    vt,
  };
}

export function composeRuntimeBuildConfig(
  buildConfig: ShapeBuildConfig,
  processingConfig: ShapeProcessingConfig,
): ShapeRuntimeBuildConfig {
  return {
    ...buildConfig,
    fetchConfig: {
      ...buildConfig.fetchConfig,
      maxConcurrent: processingConfig.fetch.maxConcurrent,
      retryAttempts: processingConfig.fetch.retryAttempts,
      retryDelay: processingConfig.fetch.retryDelay,
      retryLimit: processingConfig.fetch.retryLimit,
      retryBackoff: processingConfig.fetch.retryBackoff,
    },
    transformConfig: {
      ...buildConfig.transformConfig,
      maxConcurrent: processingConfig.transform.maxConcurrent,
    },
    vtConfig: {
      ...buildConfig.vtConfig,
      maxConcurrent: processingConfig.vt.maxConcurrent,
      dynamicConcurrency: processingConfig.vt.dynamicConcurrency,
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

export function countSelectedAdminPairs(
  selectedArrayByCountries: SelectedArrayByCountries | undefined,
): number {
  if (!selectedArrayByCountries || typeof selectedArrayByCountries !== 'object' || Array.isArray(selectedArrayByCountries)) {
    return 0;
  }
  let selectedAdminPairCount = 0;
  Object.values(selectedArrayByCountries).forEach((row) => {
    if (!Array.isArray(row)) return;
    row.forEach((selected) => {
      if (selected === true) {
        selectedAdminPairCount += 1;
      }
    });
  });
  return selectedAdminPairCount;
}
