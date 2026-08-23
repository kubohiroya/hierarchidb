import type { RouteGenerationResult } from './RouteGenerationResult.js';
import type { RouteEngineRequest } from './RouteEngineCapability.js';
import { RouteEngineInvalidResponseError } from './RouteEngineCapability.js';

export type ValidateRouteGenerationResultInput = {
  result: unknown;
  request: RouteEngineRequest;
};

export const validateRouteGenerationResult = ({
  result,
  request,
}: ValidateRouteGenerationResultInput): RouteGenerationResult => {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new RouteEngineInvalidResponseError('Route engine result must be an object');
  }
  const candidate = result as Record<string, unknown>;
  if (!Array.isArray(candidate.lineGeometry) || candidate.lineGeometry.length < 2) {
    throw new RouteEngineInvalidResponseError(
      'Route engine result lineGeometry must contain at least two coordinates'
    );
  }
  const lineGeometry = candidate.lineGeometry.map((coordinate, index) =>
    requireCoordinate(`lineGeometry[${String(index)}]`, coordinate)
  );
  requireEndpointMatch('start', lineGeometry[0], request.points[0]);
  requireEndpointMatch(
    'end',
    lineGeometry[lineGeometry.length - 1],
    request.points[request.points.length - 1]
  );
  const distance = requireFiniteNonNegative('distance', candidate.distance);
  const duration =
    candidate.duration === undefined
      ? undefined
      : requireFiniteNonNegative('duration', candidate.duration);
  return {
    lineGeometry,
    distance,
    ...(duration === undefined ? {} : { duration }),
  };
};

export const requireRouteGenerationCoordinate = (
  label: string,
  value: unknown
): [number, number] => requireCoordinate(label, value);

const requireCoordinate = (label: string, value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new RouteEngineInvalidResponseError(`${label} must be a longitude/latitude pair`);
  }
  const [longitude, latitude] = value;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new RouteEngineInvalidResponseError(`${label} contains invalid WGS84 coordinates`);
  }
  return [longitude, latitude];
};

const requireEndpointMatch = (
  label: 'start' | 'end',
  actual: [number, number] | undefined,
  expected: [number, number] | undefined
): void => {
  if (actual === undefined || expected === undefined) {
    throw new RouteEngineInvalidResponseError(`Route engine result ${label} endpoint is missing`);
  }
  if (actual[0] !== expected[0] || actual[1] !== expected[1]) {
    throw new RouteEngineInvalidResponseError(
      `Route engine result ${label} endpoint must match the request coordinate`
    );
  }
};

const requireFiniteNonNegative = (label: string, value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RouteEngineInvalidResponseError(
      `Route engine result ${label} must be a finite non-negative number`
    );
  }
  return value;
};
