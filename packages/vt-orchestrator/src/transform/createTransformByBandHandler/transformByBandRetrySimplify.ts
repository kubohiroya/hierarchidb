import type { Feature, FeatureCollection } from 'geojson';

export type RetrySimplifyFeatureResult = {
  feature: Feature;
  vertexCount: number;
  overLimit: boolean;
  retryAttempts: number;
  finalTolerance: number;
};

export type VertexLimitStats = {
  maxVertexCount: number;
  overLimitFeatureCount: number;
};

export type UpdateRetryAttemptParams = {
  featureIndex: number;
  featureTotal: number;
  attempt: number;
  attemptTotal: number;
  tolerance: number;
};

export type RetryFeatureParams = {
  feature: Feature;
  baseTolerance: number;
  retryVertexLimit: number;
  maxRetryAttempts: number;
  maxTolerance: number;
  minTolerance?: number;
  toleranceEpsilon?: number;
  featureIndex: number;
  featureTotal: number;
  runRetrySimplifyAttempt: (tolerance: number) => Promise<Feature | null>;
  countVerticesFromGeometry: (geometry: Feature['geometry'] | null | undefined) => number;
  updateRetrySimplifyAttemptPhase: (params: UpdateRetryAttemptParams) => Promise<void>;
};

export type BaseToleranceSearchResult = {
  tolerance: number;
  converged: boolean;
  iterations: number;
  finalVertexCount: number;
};

export type BaseToleranceSearchParams = {
  feature: Feature;
  retryVertexLimit: number;
  maxIterations: number;
  initialLow?: number;
  initialHigh?: number;
  highCap?: number;
  toleranceEpsilon?: number;
  runSimplifyAttempt: (tolerance: number) => Promise<Feature | null>;
  countVerticesFromGeometry: (geometry: Feature['geometry'] | null | undefined) => number;
};

const DEFAULT_BISECTION_EPSILON = 1e-7;
const DEFAULT_INITIAL_HIGH = 1;
const DEFAULT_MAX_HIGH = 12;

export const countVertexLimitOverages = (
  collection: FeatureCollection,
  retryVertexLimit: number,
  countVerticesFromGeometry: (geometry: Feature['geometry'] | null | undefined) => number,
): VertexLimitStats => {
  let maxVertexCount = 0;
  let overLimitFeatureCount = 0;
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    if (vertexCount < retryVertexLimit) continue;
    overLimitFeatureCount += 1;
    maxVertexCount = Math.max(maxVertexCount, vertexCount);
  }
  return {
    maxVertexCount,
    overLimitFeatureCount,
  };
};

export const selectMaxVertexFeature = (
  collection: FeatureCollection,
  countVerticesFromGeometry: (geometry: Feature['geometry'] | null | undefined) => number,
): { feature: Feature; featureIndex: number; vertexCount: number } | null => {
  let bestFeature: Feature | null = null;
  let bestVertexCount = -1;
  let bestIndex = -1;
  for (const [featureIndex, feature] of collection.features.entries()) {
    if (!feature?.geometry) continue;
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    if (vertexCount <= bestVertexCount) continue;
    bestFeature = feature;
    bestVertexCount = vertexCount;
    bestIndex = featureIndex;
  }
  if (!bestFeature || bestIndex < 0 || bestVertexCount < 0) return null;
  return {
    feature: bestFeature,
    featureIndex: bestIndex,
    vertexCount: bestVertexCount,
  };
};

export const findBaseToleranceByBisection = async (
  params: BaseToleranceSearchParams,
): Promise<BaseToleranceSearchResult> => {
  const {
    feature,
    retryVertexLimit,
    maxIterations,
    runSimplifyAttempt,
    countVerticesFromGeometry,
  } = params;

  const epsilon = Math.max(1e-12, params.toleranceEpsilon ?? DEFAULT_BISECTION_EPSILON);
  const boundedMaxIterations = Math.max(1, Math.min(64, Math.round(maxIterations)));
  const lowStart = Number.isFinite(params.initialLow) ? Math.max(0, params.initialLow ?? 0) : 0;
  let low = lowStart;
  let high = Number.isFinite(params.initialHigh) && (params.initialHigh ?? 0) > low
    ? (params.initialHigh as number)
    : DEFAULT_INITIAL_HIGH;
  const highCap = Number.isFinite(params.highCap) && (params.highCap ?? 0) > 0
    ? (params.highCap as number)
    : DEFAULT_MAX_HIGH;

  const baseVertexCount = countVerticesFromGeometry(feature.geometry);
  if (baseVertexCount < retryVertexLimit) {
    return {
      tolerance: low,
      converged: true,
      iterations: 0,
      finalVertexCount: baseVertexCount,
    };
  }

  let attempts = 0;
  let highFeature: Feature | null = null;
  let highVertexCount = Number.POSITIVE_INFINITY;
  while (high <= highCap) {
    const retryFeature = await runSimplifyAttempt(high);
    attempts += 1;
    if (retryFeature?.geometry) {
      highFeature = retryFeature;
      highVertexCount = countVerticesFromGeometry(retryFeature.geometry);
      if (highVertexCount < retryVertexLimit) {
        break;
      }
    }
    high *= 2;
  }

  if (!highFeature || highVertexCount >= retryVertexLimit) {
    return {
      tolerance: Math.min(highCap, high),
      converged: false,
      iterations: attempts,
      finalVertexCount: Number.isFinite(highVertexCount) ? highVertexCount : baseVertexCount,
    };
  }

  let bestTolerance = high;
  let bestVertexCount = highVertexCount;
  for (let index = 0; index < boundedMaxIterations; index += 1) {
    if (Math.abs(high - low) < epsilon) {
      return {
        tolerance: bestTolerance,
        converged: true,
        iterations: attempts,
        finalVertexCount: bestVertexCount,
      };
    }
    const mid = (low + high) / 2;
    const retryFeature = await runSimplifyAttempt(mid);
    attempts += 1;
    if (!retryFeature?.geometry) {
      low = mid;
      continue;
    }
    const retryVertexCount = countVerticesFromGeometry(retryFeature.geometry);
    if (retryVertexCount < retryVertexLimit) {
      high = mid;
      bestTolerance = mid;
      bestVertexCount = retryVertexCount;
      continue;
    }
    low = mid;
  }
  return {
    tolerance: bestTolerance,
    converged: true,
    iterations: attempts,
    finalVertexCount: bestVertexCount,
  };
};

export const retrySimplifyFeatureWithinVertexLimit = async (
  params: RetryFeatureParams,
): Promise<RetrySimplifyFeatureResult> => {
  const {
    feature,
    baseTolerance,
    retryVertexLimit,
    maxRetryAttempts,
    maxTolerance,
    minTolerance,
    toleranceEpsilon,
    featureIndex,
    featureTotal,
    runRetrySimplifyAttempt,
    countVerticesFromGeometry,
    updateRetrySimplifyAttemptPhase,
  } = params;

  if (!feature.geometry) {
    return {
      feature,
      vertexCount: 0,
      overLimit: false,
      retryAttempts: 0,
      finalTolerance: baseTolerance,
    };
  }

  const baseVertexCount = countVerticesFromGeometry(feature.geometry);
  if (baseVertexCount < retryVertexLimit) {
    return {
      feature,
      vertexCount: baseVertexCount,
      overLimit: false,
      retryAttempts: 0,
      finalTolerance: baseTolerance,
    };
  }

  let lastAttemptFeature: Feature = feature;
  let lastAttemptVertexCount = baseVertexCount;
  let lastAttemptTolerance = baseTolerance;
  let retryAttempts = 0;

  const boundedAttempts = Math.max(0, Math.min(64, Math.floor(maxRetryAttempts)));
  const epsilon = Math.max(1e-12, toleranceEpsilon ?? DEFAULT_BISECTION_EPSILON);
  const lowStart = Number.isFinite(minTolerance)
    ? Math.max(0, Math.min(minTolerance ?? 0, baseTolerance))
    : baseTolerance;
  const highStart = Number.isFinite(maxTolerance) ? maxTolerance : baseTolerance;

  if (boundedAttempts <= 0 || !Number.isFinite(highStart) || highStart <= baseTolerance) {
    return {
      feature,
      vertexCount: baseVertexCount,
      overLimit: true,
      retryAttempts: 0,
      finalTolerance: baseTolerance,
    };
  }

  let low = lowStart;
  let high = highStart;

  await updateRetrySimplifyAttemptPhase({
    featureIndex,
    featureTotal,
    attempt: 1,
    attemptTotal: boundedAttempts + 1,
    tolerance: high,
  });
  const highFeature = await runRetrySimplifyAttempt(high);
  retryAttempts += 1;
  if (highFeature?.geometry) {
    const highVertexCount = countVerticesFromGeometry(highFeature.geometry);
    lastAttemptFeature = highFeature;
    lastAttemptVertexCount = highVertexCount;
    lastAttemptTolerance = high;
    if (highVertexCount >= retryVertexLimit) {
      return {
        feature: lastAttemptFeature,
        vertexCount: lastAttemptVertexCount,
        overLimit: true,
        retryAttempts,
        finalTolerance: lastAttemptTolerance,
      };
    }
  } else {
    return {
      feature: lastAttemptFeature,
      vertexCount: lastAttemptVertexCount,
      overLimit: true,
      retryAttempts,
      finalTolerance: lastAttemptTolerance,
    };
  }

  for (let attempt = 0; attempt < boundedAttempts; attempt += 1) {
    if (Math.abs(high - low) < epsilon) {
      break;
    }
    const nextToleranceValue = (low + high) / 2;
    await updateRetrySimplifyAttemptPhase({
      featureIndex,
      featureTotal,
      attempt: retryAttempts + 1,
      attemptTotal: boundedAttempts + 1,
      tolerance: nextToleranceValue,
    });
    const retryFeature = await runRetrySimplifyAttempt(nextToleranceValue);
    retryAttempts += 1;
    lastAttemptTolerance = nextToleranceValue;
    if (!retryFeature?.geometry) break;

    const retryVertexCount = countVerticesFromGeometry(retryFeature.geometry);
    lastAttemptFeature = retryFeature;
    lastAttemptVertexCount = retryVertexCount;

    if (retryVertexCount < retryVertexLimit) {
      high = nextToleranceValue;
      continue;
    }
    low = nextToleranceValue;
  }

  return {
    feature: lastAttemptFeature,
    vertexCount: lastAttemptVertexCount,
    overLimit: lastAttemptVertexCount >= retryVertexLimit,
    retryAttempts,
    finalTolerance: lastAttemptTolerance,
  };
};
