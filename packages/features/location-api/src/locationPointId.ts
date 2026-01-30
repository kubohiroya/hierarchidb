import { digestSha256Hex } from '@hierarchidb/util';
import type { LocationPointId } from './locationTypes.js';

export const LOCATION_POINT_ID_VERSION = 'v1';
export const LOCATION_POINT_ID_PRECISION = 5;
export const LOCATION_POINT_ID_PREFIX = `p:${LOCATION_POINT_ID_VERSION}`;

const locationPointTextEncoder = new TextEncoder();

const normalizeLocationPointCoord = (value: number): string => {
  const rounded = Number(value.toFixed(LOCATION_POINT_ID_PRECISION));
  return Number.isFinite(rounded) ? rounded.toFixed(LOCATION_POINT_ID_PRECISION) : '0.00000';
};

const encodeLocationPointKey = (lat: number, lon: number): Uint8Array => {
  const latKey = normalizeLocationPointCoord(lat);
  const lonKey = normalizeLocationPointCoord(lon);
  return locationPointTextEncoder.encode(`${latKey}|${lonKey}`);
};

export const buildLocationPointIdFromLatLon = async (
  lat: number,
  lon: number,
): Promise<LocationPointId> => {
  const hash = await digestSha256Hex(encodeLocationPointKey(lat, lon));
  return `${LOCATION_POINT_ID_PREFIX}:${hash}` as LocationPointId;
};
