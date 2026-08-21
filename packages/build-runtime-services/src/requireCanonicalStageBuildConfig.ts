type ValidationOptions = {
  errorPrefix: string;
  label: string;
  requireSourceExecutionFields: boolean;
  requireGeometryExecutionFields: boolean;
  requireTileExecutionFields: boolean;
};

const FEATURE_FILTER_METHODS = new Set(['bbox_only', 'polygon_only', 'hybrid', 'none']);
const RETRY_BACKOFFS = new Set(['linear', 'exponential']);
const OMIT_DETAIL_LEVELS = new Set(['weak', 'medium', 'strong']);
const TILE_INPUT_FORMATS = new Set(['geojson', 'flatgeobuf']);
const TILE_INPUT_COMPRESSIONS = new Set(['gzip', 'none']);
const TILE_FORMATS = new Set(['mvt', 'pbf']);
const TILE_COMPRESSIONS = new Set(['gzip', 'bz']);

export const requireCanonicalStageBuildConfig = (
  value: unknown,
  options: ValidationOptions
): Record<string, unknown> => {
  const config = requireRecord(value, options.label, options.errorPrefix);
  requireSourceConfig(config.sourceConfig, options);
  requireGeometryConfig(config.geometryConfig, options);
  requireTileEmitConfig(config.tileEmitConfig, options);
  requireOptionalRecord(
    config.cleanupConfig,
    `${options.label}.cleanupConfig`,
    options.errorPrefix
  );
  return config;
};

const requireSourceConfig = (value: unknown, options: ValidationOptions): void => {
  const label = `${options.label}.sourceConfig`;
  const config = requireRecord(value, label, options.errorPrefix);
  if (options.requireSourceExecutionFields) {
    requirePositiveInteger(config.maxConcurrent, `${label}.maxConcurrent`, options.errorPrefix);
    requireNonNegativeInteger(config.retryAttempts, `${label}.retryAttempts`, options.errorPrefix);
    requireNonNegativeNumber(config.retryDelay, `${label}.retryDelay`, options.errorPrefix);
    requireNonNegativeInteger(config.retryLimit, `${label}.retryLimit`, options.errorPrefix);
    requireEnum(config.retryBackoff, RETRY_BACKOFFS, `${label}.retryBackoff`, options.errorPrefix);
  }
  requireBoolean(config.deleteOnComplete, `${label}.deleteOnComplete`, options.errorPrefix);
  requirePositiveNumber(config.timeoutMs, `${label}.timeoutMs`, options.errorPrefix);
};

const requireGeometryConfig = (value: unknown, options: ValidationOptions): void => {
  const label = `${options.label}.geometryConfig`;
  const config = requireRecord(value, label, options.errorPrefix);
  if (options.requireGeometryExecutionFields) {
    requirePositiveInteger(config.maxConcurrent, `${label}.maxConcurrent`, options.errorPrefix);
  }
  requireFiniteNumberArray(
    config.zoomBandBoundaries,
    `${label}.zoomBandBoundaries`,
    options.errorPrefix
  );
  requireBoolean(
    config.enableFeatureFiltering,
    `${label}.enableFeatureFiltering`,
    options.errorPrefix
  );
  requireNonNegativeNumber(
    config.featureAreaThreshold,
    `${label}.featureAreaThreshold`,
    options.errorPrefix
  );
  requirePositiveInteger(
    config.minVertexCountForAreaFilter,
    `${label}.minVertexCountForAreaFilter`,
    options.errorPrefix
  );
  requirePositiveNumber(
    config.aspectRatioThreshold,
    `${label}.aspectRatioThreshold`,
    options.errorPrefix
  );
  requireEnum(
    config.featureFilterMethod,
    FEATURE_FILTER_METHODS,
    `${label}.featureFilterMethod`,
    options.errorPrefix
  );
  requireRecord(config.hybridFilterConfig, `${label}.hybridFilterConfig`, options.errorPrefix);
  requireBoolean(config.deleteOnComplete, `${label}.deleteOnComplete`, options.errorPrefix);
  requireFiniteNumberArray(config.toleranceByBand, `${label}.toleranceByBand`, options.errorPrefix);
  requireNonNegativeNumber(config.areaThreshold, `${label}.areaThreshold`, options.errorPrefix);
  requireNonNegativeNumber(
    config.excludePolygonAreaCoefficient,
    `${label}.excludePolygonAreaCoefficient`,
    options.errorPrefix
  );
  const omitDetails = requireRecord(
    config.omitDetailsConfig,
    `${label}.omitDetailsConfig`,
    options.errorPrefix
  );
  requireEnum(
    omitDetails.level,
    OMIT_DETAIL_LEVELS,
    `${label}.omitDetailsConfig.level`,
    options.errorPrefix
  );
  requirePositiveInteger(config.minRingVertices, `${label}.minRingVertices`, options.errorPrefix);
};

const requireTileEmitConfig = (value: unknown, options: ValidationOptions): void => {
  const label = `${options.label}.tileEmitConfig`;
  const config = requireRecord(value, label, options.errorPrefix);
  requireBoolean(
    config.enableTopojsonSimplify,
    `${label}.enableTopojsonSimplify`,
    options.errorPrefix
  );
  if (options.requireTileExecutionFields) {
    requirePositiveInteger(config.maxConcurrent, `${label}.maxConcurrent`, options.errorPrefix);
  }
  const invalidGeometryFilter = requireRecord(
    config.invalidGeometryFilter,
    `${label}.invalidGeometryFilter`,
    options.errorPrefix
  );
  for (const field of [
    'area',
    'lineLength',
    'maxEdgeLength',
    'selfIntersection',
    'triangleRingRatio',
  ]) {
    requireBoolean(
      invalidGeometryFilter[field],
      `${label}.invalidGeometryFilter.${field}`,
      options.errorPrefix
    );
  }
  requireNonNegativeNumber(config.tolerance, `${label}.tolerance`, options.errorPrefix);
  requirePositiveInteger(config.extent, `${label}.extent`, options.errorPrefix);
  requireBoolean(config.boundaryDedupe, `${label}.boundaryDedupe`, options.errorPrefix);
  requirePositiveInteger(config.indexMaxPoints, `${label}.indexMaxPoints`, options.errorPrefix);
  requireNonEmptyString(config.layerSetName, `${label}.layerSetName`, options.errorPrefix);
  requireNonEmptyString(config.promoteId, `${label}.promoteId`, options.errorPrefix);
  requirePositiveInteger(config.tileSize, `${label}.tileSize`, options.errorPrefix);
  requireEnum(config.inputFormat, TILE_INPUT_FORMATS, `${label}.inputFormat`, options.errorPrefix);
  requireEnum(
    config.inputCompression,
    TILE_INPUT_COMPRESSIONS,
    `${label}.inputCompression`,
    options.errorPrefix
  );
  requireNonNegativeNumber(
    config.tileExpandFactor,
    `${label}.tileExpandFactor`,
    options.errorPrefix
  );
  requireNonNegativeNumber(
    config.tileExpandMargin,
    `${label}.tileExpandMargin`,
    options.errorPrefix
  );
  requireEnum(config.format, TILE_FORMATS, `${label}.format`, options.errorPrefix);
  requireEnum(config.compression, TILE_COMPRESSIONS, `${label}.compression`, options.errorPrefix);
};

const requireOptionalRecord = (value: unknown, label: string, errorPrefix: string): void => {
  if (value !== undefined) requireRecord(value, label, errorPrefix);
};

const requireRecord = (
  value: unknown,
  label: string,
  errorPrefix: string
): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[${errorPrefix}] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireBoolean = (value: unknown, label: string, errorPrefix: string): void => {
  if (typeof value !== 'boolean') {
    throw new Error(`[${errorPrefix}] ${label} must be boolean`);
  }
};

const requireNonEmptyString = (value: unknown, label: string, errorPrefix: string): void => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[${errorPrefix}] ${label} must be a non-empty string`);
  }
};

const requirePositiveInteger = (value: unknown, label: string, errorPrefix: string): void => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`[${errorPrefix}] ${label} must be a positive integer`);
  }
};

const requireNonNegativeInteger = (value: unknown, label: string, errorPrefix: string): void => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`[${errorPrefix}] ${label} must be a non-negative integer`);
  }
};

const requirePositiveNumber = (value: unknown, label: string, errorPrefix: string): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`[${errorPrefix}] ${label} must be a positive finite number`);
  }
};

const requireNonNegativeNumber = (value: unknown, label: string, errorPrefix: string): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`[${errorPrefix}] ${label} must be a non-negative finite number`);
  }
};

const requireFiniteNumberArray = (value: unknown, label: string, errorPrefix: string): void => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === 'number' && Number.isFinite(item))
  ) {
    throw new Error(`[${errorPrefix}] ${label} must be a non-empty finite number array`);
  }
};

const requireEnum = (
  value: unknown,
  allowed: ReadonlySet<unknown>,
  label: string,
  errorPrefix: string
): void => {
  if (!allowed.has(value)) {
    throw new Error(`[${errorPrefix}] ${label} is not supported: ${String(value)}`);
  }
};
