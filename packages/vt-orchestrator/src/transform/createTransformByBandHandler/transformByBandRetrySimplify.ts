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
  retryToleranceSecond: number;
  maxRetryAttempts: number;
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
    retryToleranceSecond,
    maxRetryAttempts,
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

  if (maxRetryAttempts <= 0 || !Number.isFinite(retryToleranceSecond)) {
    return {
      feature,
      vertexCount: baseVertexCount,
      overLimit: true,
      retryAttempts: 0,
      finalTolerance: baseTolerance,
    };
  }

  for (let attempt = 0; attempt < maxRetryAttempts; attempt += 1) {
    const attemptNumber = attempt + 2;
    const nextToleranceValue = attemptNumber === 2
      ? retryToleranceSecond
      : baseTolerance + (retryToleranceSecond - baseTolerance) * (2 ** (attemptNumber - 2));
    await updateRetrySimplifyAttemptPhase({
      featureIndex,
      featureTotal,
      attempt: retryAttempts + 1,
      attemptTotal: maxRetryAttempts,
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
      break;
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
