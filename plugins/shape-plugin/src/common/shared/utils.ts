/**
 * Shape plugin shared utilities
 * Pure functions that can be used in both UI and Worker environments
 */

import type {
  NodeId,
  CountryMetadata,
  DataSourceName,
  ProcessingConfig,
  DownloadProcessingConfig,
  SimplificationProcessingConfig,
  TileProcessingConfig,
  SelectionStats,
  UrlMetadata,
  ValidationResult,
  ShapeDraftData,
} from './types.js';
import type { ShapeEntity, ShapeDraft } from './types.js';
import { DEFAULT_DATA_SOURCES, DEFAULT_PROCESSING_CONFIG } from './constants.js';

const KNOWN_DATA_SOURCE_NAMES = new Set<DataSourceName>(
  DEFAULT_DATA_SOURCES.map((source) => source.name),
);

export function normalizeDataSourceName(value?: string | null): DataSourceName | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return KNOWN_DATA_SOURCE_NAMES.has(normalized as DataSourceName)
    ? (normalized as DataSourceName)
    : undefined;
}

/**
 * Validate shape-plugin entity name
 */
export function validateShapeName(name: string): ValidationResult {
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
export function validateProcessingConfig(config: Partial<ProcessingConfig>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const downloadConcurrency = config.downloadConfig?.maxConcurrent ?? config.concurrentDownloads;
  if (downloadConcurrency !== undefined) {
    if (downloadConcurrency < 1 || downloadConcurrency > 10) {
      errors.push('Concurrent downloads must be between 1 and 10');
    }
  }

  const simplifyWorkers = config.simplificationConfig?.level1Workers ?? config.concurrentProcesses;
  if (simplifyWorkers !== undefined) {
    if (simplifyWorkers < 1 || simplifyWorkers > 8) {
      errors.push('Concurrent processes must be between 1 and 8');
    }
  }

  const maxZoom = config.tileConfig?.maxZoom ?? config.maxZoomLevel;
  if (maxZoom !== undefined) {
    if (maxZoom < 8 || maxZoom > 18) {
      errors.push('Max zoom level must be between 8 and 18');
    }
    if (maxZoom > 14) {
      warnings.push('High zoom levels may require significant storage and processing time');
    }
  }

  const areaThreshold = config.simplificationConfig?.areaThreshold ?? config.featureAreaThreshold;
  if (areaThreshold !== undefined) {
    if (areaThreshold < 0 || areaThreshold > 1) {
      errors.push('Feature area threshold must be between 0 and 1');
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
  const countryMap = new Map(countryMetadata.map((c) => [c.countryCode, c]));

  countries.forEach((countryCode) => {
    const country = countryMap.get(countryCode);
    if (!country) return;

    adminLevels.forEach((level) => {
      if (!country.availableAdminLevels.includes(level)) return;

      const url = buildDataSourceUrl(dataSource, countryCode, level);
      if (url) {
        urlMetadata.push({
          url,
          countryCode,
          adminLevel: level,
          continent: country.continent,
          estimatedSize: estimateDataSize(dataSource, countryCode, level, country),
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
    naturalearth: 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download',
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
export function mergeProcessingConfig(config: Partial<ProcessingConfig>): ProcessingConfig {
  const merged: ProcessingConfig = {
    ...DEFAULT_PROCESSING_CONFIG,
    ...config,
    downloadConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.downloadConfig ?? { maxConcurrent: 2 }),
      ...(config.downloadConfig ?? {}),
    } as DownloadProcessingConfig,
    simplificationConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.simplificationConfig ?? {
        enableFiltering: false,
        featureFilterMethod: 'hybrid',
        areaThreshold: 0.1,
        level1Workers: 2,
        level2Workers: 2,
        tolerance: 0.01,
      }),
      ...(config.simplificationConfig ?? {}),
    } as SimplificationProcessingConfig,
    tileConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.tileConfig ?? {
        workers: 2,
        maxZoom: 12,
      }),
      ...(config.tileConfig ?? {}),
    } as TileProcessingConfig,
    cleanupConfig: {
      ...(DEFAULT_PROCESSING_CONFIG.cleanupConfig ?? {}),
      ...(config.cleanupConfig ?? {}),
    },
  };

  merged.dataSource = config.dataSource ?? DEFAULT_PROCESSING_CONFIG.dataSource;

  if (merged.downloadConfig) {
    merged.concurrentDownloads = merged.downloadConfig.maxConcurrent;
    merged.corsProxyBaseURL = merged.downloadConfig.corsProxyUrl;
  }
  if (merged.simplificationConfig) {
    merged.enableFeatureFiltering = merged.simplificationConfig.enableFiltering;
    merged.featureFilterMethod = merged.simplificationConfig.featureFilterMethod;
    merged.featureAreaThreshold = merged.simplificationConfig.areaThreshold;
    merged.simplificationTolerance = merged.simplificationConfig.tolerance;
    merged.concurrentProcesses = merged.simplificationConfig.level1Workers;
  }
  if (merged.tileConfig) {
    merged.maxZoomLevel = merged.tileConfig.maxZoom;
    merged.tileBufferSize = merged.tileConfig.bufferSize;
  }

  return merged;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 2 + 9);
  return `session-${timestamp}-${random}`;
}

/**
 * Generate a unique task ID
 */
export function generateTaskId(type: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 2 + 5);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / k ** i).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable time
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
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
 * Serialize checkbox state
 */
export function serializeCheckboxState(state: boolean[][]): string {
  return JSON.stringify(state);
}

/**
 * Build a new ShapeEntity from create data (shared mapping)
 */
export function buildShapeEntityFromCreate(
  params: {
    nodeId: NodeId;
    data: {
      name: string;
      description?: string;
      dataSourceName: DataSourceName;
      processingConfig?: Partial<ProcessingConfig> | ProcessingConfig;
    };
  },
): ShapeEntity {
  const merged = mergeProcessingConfig(
    (params.data.processingConfig as Partial<ProcessingConfig>) || {},
  );
  return {
    id: params.nodeId,
    nodeId: params.nodeId,
    name: params.data.name,
    description: params.data.description || '',
    dataSourceName: params.data.dataSourceName,
    licenseAgreement: false,
    processingConfig: merged,
    checkboxState: '[]',
    selectedCountries: [],
    adminLevels: [],
    urlMetadata: [],
    processingStatus: 'idle',
  };
}

/**
 * Create a ShapeDraft from an entity (shared mapping)
 */
export function createDraftFromEntity(entity: ShapeEntity): ShapeDraft {
  const checkboxState = Array.isArray(entity.checkboxState)
    ? entity.checkboxState
    : typeof entity.checkboxState === 'string'
      ? parseCheckboxState(entity.checkboxState)
      : [];

  const normalizedDataSource = normalizeDataSourceName(entity.dataSourceName);
  const draftPayload: ShapeDraftData = {
    dataSourceName: normalizedDataSource ?? 'naturalearth',
    licenseAgreement: entity.licenseAgreement ?? false,
    processingConfig: mergeProcessingConfig(entity.processingConfig ?? {}),
    checkboxState,
    batchSessionId: entity.batchSessionId,
    processingStatus: entity.processingStatus ?? 'idle',
    licenseAgreedAt: entity.licenseAgreedAt,
    tabularMetadataId: entity.tabularMetadataId,
    tabularFilters: entity.tabularFilters,
  };

  const treeNodeId = (entity.nodeId ?? entity.id ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)) as NodeId;

  const draft: ShapeDraft = {
    treeNodeId,
    draftData: draftPayload,
    draftMetadata: {
      name: entity.name ?? '',
      description: entity.description ?? '',
    },
    depth: 0,
    resumeStep: entity.resumeStep,
  };

  return draft;
}

/**
 * Map a draft back to entity updates (shared mapping)
 */
export function mapDraftToUpdates(
  draft: ShapeDraft | ShapeDraftData,
  metadata?: { name?: string; description?: string; tags?: string[] },
): Partial<ShapeEntity> {
  const source: ShapeDraftData =
    'draftData' in draft ? (draft.draftData ?? {}) : (draft as ShapeDraftData);

  const updates: Partial<ShapeEntity> = {};

  if (metadata) {
    if (typeof metadata.name === 'string') updates.name = metadata.name;
    if (typeof metadata.description === 'string') updates.description = metadata.description;
  }

  const normalizedDataSource = normalizeDataSourceName(source.dataSourceName);
  if (normalizedDataSource) {
    updates.dataSourceName = normalizedDataSource;
  }
  if (typeof source.licenseAgreement === 'boolean') {
    updates.licenseAgreement = source.licenseAgreement;
  }
  if (source.processingConfig) {
    updates.processingConfig = mergeProcessingConfig(source.processingConfig);
  }
  if (source.checkboxState !== undefined) {
    updates.checkboxState = source.checkboxState;
  }

  if (typeof source.batchSessionId === 'string') {
    updates.batchSessionId = source.batchSessionId;
  }
  if (typeof source.processingStatus === 'string') {
    updates.processingStatus = source.processingStatus;
  }

  if (source.licenseAgreedAt) {
    updates.licenseAgreedAt = source.licenseAgreedAt;
  }
  if (typeof source.tabularMetadataId === 'string') {
    updates.tabularMetadataId = source.tabularMetadataId;
  } else if (source.tabularMetadataId === undefined) {
    updates.tabularMetadataId = undefined;
  }
  if (Array.isArray(source.tabularFilters)) {
    updates.tabularFilters = source.tabularFilters;
  }

  return updates;
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
