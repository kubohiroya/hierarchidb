/**
 * Shape plugin shared utilities
 * Pure functions that can be used in both UI and Worker environments
 */

import type {
  CountryMetadata,
  DataSourceName,
  ShapeEntity,
  BatchConfig,
  DownloadBatchConfig,
  SimplificationBatchConfig,
  TileBatchConfig,
  SelectionStats,
  UrlMetadata,
  ShapeStepValidationResult,
} from '../../common/types/index.js';
import { SHAPE_DATA_SOURCES, DEFAULT_PROCESSING_CONFIG } from '../../common/types/constants.js';

const KNOWN_DATA_SOURCE_NAMES = new Set<DataSourceName>(
  SHAPE_DATA_SOURCES.map((source) => source.name),
);

export function normalizeDataSourceName(value?: string | null): DataSourceName | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return KNOWN_DATA_SOURCE_NAMES.has(normalized as DataSourceName)
    ? (normalized as DataSourceName)
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

type ShapeDraft = {
  draftData: ShapeEntity;
};

export function createDraftFromEntity(entity: ShapeEntity): ShapeDraft {
  const normalizedDataSourceName =
    normalizeDataSourceName(entity.batchConfig?.dataSource ?? entity.dataSourceName)
    ?? entity.batchConfig?.dataSource
    ?? entity.dataSourceName;
  return {
    draftData: {
      ...entity,
      batchConfig: {
        ...entity.batchConfig,
        dataSource: normalizedDataSourceName,
      },
      dataSourceName: normalizedDataSourceName,
    },
  };
}

export function mapDraftToUpdates(draft: ShapeDraft): Partial<ShapeEntity> {
  const draftData = draft.draftData;
  const normalizedDataSourceName =
    normalizeDataSourceName(draftData.batchConfig?.dataSource ?? draftData.dataSourceName)
    ?? draftData.batchConfig?.dataSource
    ?? draftData.dataSourceName;
  return {
    ...draftData,
    batchConfig: {
      ...draftData.batchConfig,
      dataSource: normalizedDataSourceName,
    },
    dataSourceName: normalizedDataSourceName,
  };
}

/**
 * Validate shape-plugin entity name
 */
export function validateShapeName(name: string): ShapeStepValidationResult {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push('Name is required');
  }

  if (name.length > 100) {
    errors.push('Name must be 100 characters or less');
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    errors.push('Name can only contain letters, numbers, spaces, hyphens, and underscores');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate processing configuration
 */
export function validateBatchConfig(config: Partial<BatchConfig>): ShapeStepValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const downloadConcurrency = config.downloadConfig?.maxConcurrent;
  if (downloadConcurrency !== undefined) {
    if (downloadConcurrency < 1 || downloadConcurrency > 10) {
      errors.push('Concurrent downloads must be between 1 and 10');
    }
  }

  const simplifyWorkers = config.simplificationConfig?.level1Workers;
  if (simplifyWorkers !== undefined) {
    if (simplifyWorkers < 1 || simplifyWorkers > 8) {
      errors.push('Concurrent processes must be between 1 and 8');
    }
  }

  const minZoom = config.tileConfig?.minZoom;
  const maxZoom = config.tileConfig?.maxZoom;
  if (minZoom !== undefined) {
    if (minZoom < 0 || minZoom > 18) {
      errors.push('Min zoom level must be between 0 and 18');
    }
  }
  if (maxZoom !== undefined) {
    if (maxZoom < 0 || maxZoom > 18) {
      errors.push('Max zoom level must be between 0 and 18');
    }
    if (maxZoom > 14) {
      warnings.push('High zoom levels may require significant storage and processing time');
    }
  }
  if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom) {
    errors.push('Min zoom level must be less than or equal to max zoom level');
  }

  const areaThreshold = config.simplificationConfig?.areaThreshold;
  if (areaThreshold !== undefined) {
    if (areaThreshold < 1 || areaThreshold > 100) {
      errors.push('Feature area threshold must be between 1 and 100');
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
export function calculateSelectionStats(urlMetadata: UrlMetadata[]): SelectionStats {
  if (urlMetadata.length === 0) {
    return {
      totalSelected: 0,
      countriesWithSelection: 0,
      levelCounts: [],
      estimatedSize: 0,
      estimatedFeatures: 0,
      estimatedProcessingTime: 0,
    };
  }

  const countries = new Set<string>();
  const levelCounts: number[] = new Array(6).fill(0);
  let estimatedSize = 0;
  let estimatedFeatures = 0;

  urlMetadata.forEach((metadata) => {
    countries.add(metadata.countryCode);
    const lvl = metadata.adminLevel;
    if (typeof lvl === 'number' && lvl >= 0 && lvl < levelCounts.length) {
      levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
    }
    if (typeof metadata.estimatedSize === 'number') {
      estimatedSize += metadata.estimatedSize;
      // Rough estimate: 1MB ~ 1000 features
      estimatedFeatures += Math.floor(metadata.estimatedSize / 1000);
    }
  });

  // Rough processing time estimate: 1 second per 1000 features + 10 seconds base
  const estimatedProcessingTime = Math.ceil(estimatedFeatures / 1000) + 10;

  return {
    totalSelected: urlMetadata.length,
    countriesWithSelection: countries.size,
    levelCounts,
    estimatedSize,
    estimatedFeatures,
    estimatedProcessingTime,
  };
}

/**
 * Generate URL metadata for selected countries and admin levels
 */
export function generateUrlMetadata(
  dataSource: DataSourceName,
  countries: string[],
  adminLevels: number[],
  countryMetadata: CountryMetadata[],
): UrlMetadata[] {
  const urlMetadata: UrlMetadata[] = [];
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
      const url = buildDataSourceUrl(dataSource, resolvedCode, level);
      if (url) {
        urlMetadata.push({
          url,
          countryCode: resolvedCode,
          countryName: country.countryName,
          adminLevel: level,
          continent: country.continent,
          dataSource,
          estimatedSize: estimateDataSize(dataSource, resolvedCode, level, country),
          lastUpdated: new Date().toISOString(),
        });
      }
    });
  });

  return urlMetadata;
}

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
    geoboundaries: 'https://www.geoboundaries.org/api/gbOpen',
    // Use GADM v4.1 GPKG endpoint to align with runtime-worker workers/tests
    gadm: 'https://geodata.ucdavis.edu/gadm/gadm4.1/gpkg',
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
      // v4.1 GPKG bundles levels per country; adminLevel is not encoded in filename
      return `${baseUrl}/${countryCode}_adm_gpkg.zip`;
    case 'openstreetmap':
      return `${baseUrl}/${countryCode.toLowerCase()}-latest.osm.pbf`;
    default:
      return null;
  }
}

/**
 * Estimate data size based on country and admin level
 */
function estimateDataSize(
  dataSource: DataSourceName,
  _countryCode: string,
  adminLevel: number,
  country: CountryMetadata,
): number {
  // Base size factors per data source (in KB)
  const baseSizeFactors = {
    naturalearth: 100,
    geoboundaries: 50,
    gadm: 200,
    openstreetmap: 1000,
  };

  // Admin level multipliers
  const adminLevelMultipliers = [1, 2, 5, 10, 20, 50];

  // Population factor (larger countries = more data)
  const populationFactor = Math.log10((country.population || 1000000) / 1000000) + 1;

  const baseSize = baseSizeFactors[dataSource] || 100;
  const adminMultiplier = adminLevelMultipliers[adminLevel] || 1;

  return Math.round(baseSize * adminMultiplier * populationFactor * 1000); // Convert to bytes
}

/**
 * Merge processing config with defaults
 */
export function mergeBatchConfig(config: Partial<BatchConfig>): BatchConfig {
  return {
    dataSource: config.dataSource ?? DEFAULT_PROCESSING_CONFIG.dataSource,
    downloadConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.downloadConfig ?? { maxConcurrent: 2 }),
      ...(config.downloadConfig ?? {}),
    } as DownloadBatchConfig,
    simplificationConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.simplificationConfig ?? {
        featureFilterMethod: 'hybrid',
        areaThreshold: 0.1,
        level1Workers: 2,
        level2Workers: 2,
        tolerance: 0.01,
      }),
      ...(config.simplificationConfig ?? {}),
    } as SimplificationBatchConfig,
    tileConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.tileConfig ?? {
        workers: 2,
        minZoom: 0,
        maxZoom: 12,
      }),
      ...(config.tileConfig ?? {}),
    } as TileBatchConfig,
    cleanupConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.cleanupConfig ?? {}),
      ...(config.cleanupConfig ?? {}),
    },
    source: config.source ?? DEFAULT_PROCESSING_CONFIG.source,
  };
}

/**
 * Parse serialized checkbox state
 */
export function parseCheckboxState(state: boolean[][] | string): boolean[][] {
  if (typeof state === 'string') {
    try {
      return JSON.parse(state) as boolean[][];
    } catch {
      return [];
    }
  }
  return state;
}

/**
 * Summarize checkbox state into simple derived information.
 */
export function summarizeCheckboxState(state: boolean[][] | string | undefined): {
  hasSelection: boolean;
  levels: number[];
  selectedRowCount: number;
  totalSelections: number;
} {
  const matrix: boolean[][] = Array.isArray(state)
    ? state
    : typeof state === 'string'
      ? parseCheckboxState(state)
      : [];

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
