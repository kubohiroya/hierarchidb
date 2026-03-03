import type { Feature, FeatureCollection, Geometry } from 'geojson';
import {
  geometrySimplify,
  type GeometryEngine,
  type OmitDetailsConfig,
  type PreSimplifyFilterConfig,
  type RingFixConfig,
  type SelfIntersectionConfig,
  type SelfIntersectionTuningConfig,
} from '@hierarchidb/gis-sdk';
import { applySelfIntersectionFix, applyOmitDetailsFilter, applyPolygonAreaExclusion, recoverInvalidSelfIntersection } from './filters.js';
import {
  isGeometryValid,
  cleanGeometry,
  validateSimplifiedGeometry,
  formatGeometryDiagnostics,
} from './validation.js';
import { applyRingFix } from './ring.js';
import { snapGeometryToGrid } from './snap.js';
import { metersPerPixel, countVerticesFromGeometry, hasNonFiniteGeometry } from './metrics.js';

type SimplifyProgress = {
  processed: number;
  total: number;
  featureIndex: number;
};

export type SimplifyIssueStage =
  | 'input'
  | 'snap'
  | 'clean'
  | 'ringFix'
  | 'omitDetails'
  | 'areaExclusion'
  | 'selfIntersection'
  | 'validate';

export type SimplifyIssue = {
  featureId: string;
  featureIndex: number;
  stage: SimplifyIssueStage;
  kind:
    | 'nonFinite'
    | 'invalidGeometry'
    | 'invalidRing'
    | 'openRing'
    | 'degenerateRing'
    | 'duplicateVertex'
    | 'smallPolygon'
    | 'droppedPolygon'
    | 'unknown';
  message: string;
};

export type SimplifyIssueKind = SimplifyIssue['kind'];

type SimplifyPhase =
  | 'preprocess:start'
  | 'preprocess:done'
  | 'selfIntersection:start'
  | 'selfIntersection:done'
  | 'simplify:start'
  | 'simplify:done';

export type SimplifyOptions = {
  onProgress?: (progress: SimplifyProgress) => void | Promise<void>;
  onIssue?: (issue: SimplifyIssue) => void | Promise<void>;
  onPhase?: (phase: SimplifyPhase) => void | Promise<void>;
  abortSignal?: AbortSignal;
  yieldEvery?: number;
};

const resolveFeatureId = (feature: Feature, featureIndex: number): string => {
  const rawId = feature.id ?? (feature.properties && 'id' in feature.properties ? feature.properties.id : undefined);
  if (rawId !== undefined && rawId !== null) return String(rawId);
  return `featureIndex:${featureIndex}`;
};

const recordIssue = async (
  options: SimplifyOptions | undefined,
  issue: SimplifyIssue,
): Promise<void> => {
  if (!options?.onIssue) return;
  await options.onIssue(issue);
};

export const simplifyFeatureCollection = async (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
  ringFixConfig: RingFixConfig | undefined,
  selfIntersectionConfig: SelfIntersectionConfig | undefined,
  selfIntersectionTuningConfig: SelfIntersectionTuningConfig,
  preSimplifyFilterConfig: PreSimplifyFilterConfig | undefined,
  quantize: number | undefined,
  excludePolygonAreaCoefficient: number,
  omitDetailsConfig: OmitDetailsConfig,
  geometryEngine?: GeometryEngine,
  options?: SimplifyOptions,
): Promise<FeatureCollection> => {
  const metersPerPixelValue = metersPerPixel(zTarget);
  const engine = geometryEngine ?? 'turf';
  const baseToleranceK = toleranceK;
  const toMetersTolerance = (value: number): number => {
    if (!Number.isFinite(metersPerPixelValue) || metersPerPixelValue <= 0) return value;
    return value * metersPerPixelValue;
  };
  const ringFix = ringFixConfig ?? {
    minRingVertices: 4,
    minRingAreaMultiplier: 1,
    removeDuplicateConsecutivePoints: true,
    removeCollinearPoints: false,
  };
  const selfIntersection = selfIntersectionConfig ?? {
    strategy: 'keep_largest',
    minPolygonAreaMultiplier: 1,
    maxPolygons: 1,
    retainHoles: false,
    snapToleranceMultiplier: 1,
  };
  const selfIntersectionTuning = selfIntersectionTuningConfig;
  const preSimplify = preSimplifyFilterConfig ?? {
    excludeInvalidGeometry: true,
    dropInvalidHoles: true,
    splitSelfIntersections: true,
    dropSmallPolygons: true,
    maxVerticesPerFeature: 0,
  };
  const enforcePreSimplifyValidity = preSimplify.excludeInvalidGeometry && zTarget > 3;
  const maxVerticesPerFeature = preSimplify.maxVerticesPerFeature ?? 0;
  const yieldEvery = Math.max(1, Math.floor(options?.yieldEvery ?? 25));
  const baseArea = Math.pow(metersPerPixel(zTarget) * 2, 2);
  const minRingArea = baseArea * ringFix.minRingAreaMultiplier;
  const minPolygonArea = baseArea * selfIntersection.minPolygonAreaMultiplier;
  const features: Feature[] = [];
  let droppedNonFinite = 0;
  let droppedRingFix = 0;
  let droppedOmitDetails = 0;
  let droppedInvalidAfterRingFix = 0;
  let droppedArea = 0;
  let droppedIntersection = 0;
  let droppedInvalidAfterIntersection = 0;
  let oversizedCount = 0;
  const oversizedSamples: string[] = [];
  let diagnosticLogsEmitted = 0;
  const diagnosticLogLimit = 5;
  const total = collection.features.length;
  let selfIntersectionStarted = false;
  let simplifyStarted = false;
  if (options?.onPhase) {
    await options.onPhase('preprocess:start');
  }
  for (const [index, feature] of collection.features.entries()) {
    if (options?.abortSignal?.aborted) {
      throw new Error('task aborted');
    }
    if (!feature.geometry) {
      features.push(feature);
    } else {
      const featureId = resolveFeatureId(feature, index);
      if (maxVerticesPerFeature > 0) {
        const vertexCount = countVerticesFromGeometry(feature.geometry);
        if (vertexCount > maxVerticesPerFeature) {
          oversizedCount += 1;
          if (oversizedSamples.length < 3) {
            const rawId = feature.id ?? (feature.properties && 'id' in feature.properties
              ? feature.properties.id
              : undefined);
            const sampleId = rawId != null ? String(rawId) : `featureIndex:${index}`;
            oversizedSamples.push(sampleId);
          }
        }
      }
      if (hasNonFiniteGeometry(feature.geometry)) {
        droppedNonFinite += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'input',
          kind: 'nonFinite',
          message: 'non-finite coordinates detected',
        });
        continue;
      }
      let snapped: Geometry;
      try {
        snapped = snapGeometryToGrid(feature.geometry, zTarget, quantize);
      } catch {
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'snap',
          kind: 'invalidGeometry',
          message: 'snap to grid failed',
        });
        continue;
      }
      const cleaned = cleanGeometry(snapped);
      const ringFixed = applyRingFix(cleaned, ringFix, minRingArea, preSimplify.dropInvalidHoles, engine);
      if (!ringFixed) {
        droppedRingFix += 1;
        const cleanedDiagnostics = formatGeometryDiagnostics(cleaned, engine);
        if (diagnosticLogsEmitted < diagnosticLogLimit) {
          diagnosticLogsEmitted += 1;
          console.warn('[ShapeTransform][SimplifyDiagnostics] invalid after ring fix (rings removed)', {
            featureId,
            featureIndex: index,
            zTarget,
            input: cleanedDiagnostics,
          });
        }
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'ringFix',
          kind: 'invalidRing',
          message: `ring fix removed all rings (input=${cleanedDiagnostics})`,
        });
        continue;
      }
      const ringFixedValid = isGeometryValid(ringFixed, engine);
      let ringFixCandidate = ringFixed;
      if (enforcePreSimplifyValidity && !ringFixedValid) {
        droppedInvalidAfterRingFix += 1;
        const cleanedDiagnostics = formatGeometryDiagnostics(cleaned, engine);
        const ringFixedDiagnostics = formatGeometryDiagnostics(ringFixed, engine);
        if (diagnosticLogsEmitted < diagnosticLogLimit) {
          diagnosticLogsEmitted += 1;
          console.warn('[ShapeTransform][SimplifyDiagnostics] invalid after ring fix', {
            featureId,
            featureIndex: index,
            zTarget,
            before: cleanedDiagnostics,
            after: ringFixedDiagnostics,
          });
        }
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'ringFix',
          kind: 'invalidGeometry',
          message: `geometry invalid after ring fix (before=${cleanedDiagnostics} after=${ringFixedDiagnostics})`,
        });
        const recovered = recoverInvalidSelfIntersection(
          ringFixed,
          selfIntersection,
          ringFix,
          minRingArea,
          preSimplify.dropInvalidHoles,
          engine,
        );
        if (recovered && isGeometryValid(recovered, engine)) {
          ringFixCandidate = recovered;
          if (diagnosticLogsEmitted < diagnosticLogLimit) {
            diagnosticLogsEmitted += 1;
            console.warn('[ShapeTransform][SimplifyDiagnostics] recovered invalid ring fix via unkink', {
              featureId,
              featureIndex: index,
              zTarget,
              recovered: formatGeometryDiagnostics(recovered, engine),
            });
          }
        }
      }
      const omittedDetails = applyOmitDetailsFilter(ringFixCandidate, omitDetailsConfig, zTarget, engine);
      if (!omittedDetails) {
        droppedOmitDetails += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'omitDetails',
          kind: 'smallPolygon',
          message: 'polygon omitted by omit-details filter',
        });
        continue;
      }
      const areaFiltered = applyPolygonAreaExclusion(
        omittedDetails,
        excludePolygonAreaCoefficient,
        zTarget,
        quantize,
        engine,
      );
      if (!areaFiltered) {
        droppedArea += 1;
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'areaExclusion',
          kind: 'smallPolygon',
          message: 'polygon excluded by area filter',
        });
        continue;
      }
      if (!selfIntersectionStarted && options?.onPhase) {
        selfIntersectionStarted = true;
        await options.onPhase('selfIntersection:start');
      }
      const intersectionFixed = applySelfIntersectionFix(
        areaFiltered,
        selfIntersection,
        selfIntersectionTuning,
        minPolygonArea,
        zTarget,
        quantize,
        engine,
        {
          splitSelfIntersections: preSimplify.splitSelfIntersections,
          dropSmallPolygons: preSimplify.dropSmallPolygons,
          minRingVertices: ringFix.minRingVertices,
        },
      );
      if (!intersectionFixed) {
        droppedIntersection += 1;
        const areaDiagnostics = formatGeometryDiagnostics(areaFiltered, engine);
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'selfIntersection',
          kind: 'droppedPolygon',
          message: `self-intersection fix removed polygons (input=${areaDiagnostics})`,
        });
        continue;
      }
      let intersectionCandidate = intersectionFixed;
      if (preSimplify.excludeInvalidGeometry && !isGeometryValid(intersectionCandidate, engine)) {
        const intersectionRepaired = applyRingFix(
          cleanGeometry(intersectionCandidate),
          ringFix,
          minRingArea,
          preSimplify.dropInvalidHoles,
          engine,
        );
        if (intersectionRepaired) {
          intersectionCandidate = intersectionRepaired;
        }
        if (!isGeometryValid(intersectionCandidate, engine)) {
          const recoveredFromArea = recoverInvalidSelfIntersection(
            areaFiltered,
            selfIntersection,
            ringFix,
            minRingArea,
            preSimplify.dropInvalidHoles,
            engine,
          );
          const recoveredFromIntersection = recoverInvalidSelfIntersection(
            intersectionCandidate,
            selfIntersection,
            ringFix,
            minRingArea,
            preSimplify.dropInvalidHoles,
            engine,
          );
          const recovered = recoveredFromArea ?? recoveredFromIntersection;
          if (recovered && isGeometryValid(recovered, engine)) {
            intersectionCandidate = recovered;
            if (diagnosticLogsEmitted < diagnosticLogLimit) {
              diagnosticLogsEmitted += 1;
              console.warn('[ShapeTransform][SimplifyDiagnostics] recovered invalid self-intersection via unkink', {
                featureId,
                featureIndex: index,
                zTarget,
                recovered: formatGeometryDiagnostics(recovered, engine),
              });
            }
          }
        }
      }
      if (preSimplify.excludeInvalidGeometry && !isGeometryValid(intersectionCandidate, engine)) {
        droppedInvalidAfterIntersection += 1;
        const areaDiagnostics = formatGeometryDiagnostics(areaFiltered, engine);
        const intersectionDiagnostics = formatGeometryDiagnostics(intersectionCandidate, engine);
        if (diagnosticLogsEmitted < diagnosticLogLimit) {
          diagnosticLogsEmitted += 1;
          console.warn('[ShapeTransform][SimplifyDiagnostics] invalid after self-intersection fix', {
            featureId,
            featureIndex: index,
            zTarget,
            before: areaDiagnostics,
            after: intersectionDiagnostics,
          });
        }
        await recordIssue(options, {
          featureId,
          featureIndex: index,
          stage: 'validate',
          kind: 'invalidGeometry',
          message: `geometry invalid after self-intersection fix (before=${areaDiagnostics} after=${intersectionDiagnostics})`,
        });
        continue;
      }
      if (!simplifyStarted && options?.onPhase) {
        simplifyStarted = true;
        await options.onPhase('simplify:start');
      }
      const simplified = geometrySimplify(intersectionCandidate, engine, {
        tolerance: toMetersTolerance(baseToleranceK),
        highQuality: false,
        mutate: false,
        preserveTopology: true,
      }) as Geometry;
      const validated = validateSimplifiedGeometry(
        simplified,
        ringFix,
        minRingArea,
        preSimplify.dropInvalidHoles,
        engine,
      );
      features.push({ ...feature, geometry: validated });
    }
    const processed = index + 1;
    if (options?.onProgress && (processed % yieldEvery === 0 || processed === total)) {
      await options.onProgress({ processed, total, featureIndex: index });
    }
    if (processed % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  if (oversizedCount > 0) {
    console.warn('[ShapeTransform][SimplifyDiagnostics] oversized features observed during simplify', {
      oversizedCount,
      maxVerticesPerFeature,
      samples: oversizedSamples,
    });
  }
  if (options?.onPhase) {
    await options.onPhase('preprocess:done');
    if (selfIntersectionStarted) {
      await options.onPhase('selfIntersection:done');
    }
    if (simplifyStarted) {
      await options.onPhase('simplify:done');
    }
  }
  if (features.length === 0 && total > 0) {
    console.warn('[ShapeTransform][SimplifyDiagnostics] simplify removed all features', {
      zTarget,
      total,
      droppedNonFinite,
      droppedRingFix,
      droppedOmitDetails,
      droppedInvalidAfterRingFix,
      droppedArea,
      droppedIntersection,
      droppedInvalidAfterIntersection,
      oversizedCount,
    });
  }
  return { ...collection, features };
};
