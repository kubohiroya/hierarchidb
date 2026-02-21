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
  retryToleranceStep: number;
  maxRetrySteps: number;
  featureIndex: number;
  featureTotal: number;
  runRetrySimplifyAttempt: (tolerance: number) => Promise<Feature | null>;
  countVerticesFromGeometry: (geometry: Feature['geometry'] | null | undefined) => number;
  updateRetrySimplifyAttemptPhase: (params: UpdateRetryAttemptParams) => Promise<void>;
};

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

export const retrySimplifyFeatureWithinVertexLimit = async (
  params: RetryFeatureParams,
): Promise<RetrySimplifyFeatureResult> => {
  const {
    feature,
    baseTolerance,
    retryVertexLimit,
    retryToleranceStep,
    maxRetrySteps,
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

  let lastFailTolerance = baseTolerance;
  let successTolerance: number | null = null;
  let successIndex: number | null = null;
  let bestFeature: Feature | null = null;
  let bestTolerance = baseTolerance;
  let bestVertexCount = baseVertexCount;
  let lastAttemptFeature: Feature = feature;
  let lastAttemptVertexCount = baseVertexCount;
  let lastAttemptTolerance = baseTolerance;
  let retryAttempts = 0;

  if (retryToleranceStep <= 0) {
    return {
      feature,
      vertexCount: baseVertexCount,
      overLimit: true,
      retryAttempts: 0,
      finalTolerance: baseTolerance,
    };
  }

  for (let i = 0; i < maxRetrySteps; i += 1) {
    const nextToleranceValue = baseTolerance + retryToleranceStep * (i + 1);
    await updateRetrySimplifyAttemptPhase({
      featureIndex,
      featureTotal,
      attempt: retryAttempts + 1,
      attemptTotal: maxRetrySteps,
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
      successTolerance = nextToleranceValue;
      successIndex = i;
      bestFeature = retryFeature;
      bestTolerance = nextToleranceValue;
      bestVertexCount = retryVertexCount;
      break;
    }

    lastFailTolerance = nextToleranceValue;
  }

  if (bestFeature && successTolerance !== null && successIndex !== null) {
    const bisectionSteps = Math.max(0, 8 - Math.ceil(successIndex / 2));
    const bisectionAttemptTotal = maxRetrySteps + bisectionSteps;
    let low = lastFailTolerance;
    let high = successTolerance;

    for (let stepIndex = 0; stepIndex < bisectionSteps; stepIndex += 1) {
      const mid = (low + high) / 2;
      await updateRetrySimplifyAttemptPhase({
        featureIndex,
        featureTotal,
        attempt: retryAttempts + 1,
        attemptTotal: bisectionAttemptTotal,
        tolerance: mid,
      });
      const midFeature = await runRetrySimplifyAttempt(mid);
      retryAttempts += 1;
      lastAttemptTolerance = mid;
      if (!midFeature?.geometry) break;

      const midVertexCount = countVerticesFromGeometry(midFeature.geometry);
      if (midVertexCount < retryVertexLimit) {
        high = mid;
        bestFeature = midFeature;
        bestTolerance = mid;
        bestVertexCount = midVertexCount;
      } else {
        low = mid;
      }
    }

    if (bestFeature) {
      return {
        feature: bestFeature,
        vertexCount: bestVertexCount,
        overLimit: false,
        retryAttempts,
        finalTolerance: bestTolerance,
      };
    }
  }

  return {
    feature: lastAttemptFeature,
    vertexCount: lastAttemptVertexCount,
    overLimit: lastAttemptVertexCount >= retryVertexLimit,
    retryAttempts,
    finalTolerance: lastAttemptTolerance,
  };
};
