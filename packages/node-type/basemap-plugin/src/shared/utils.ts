/**
 * @file shared/utils.ts
 * @description BaseMap utility functions
 */

import { VALIDATION_LIMITS } from './constants.js';
import type { MapViewport } from './types.js';

export function validateLongitude(lng: number): boolean {
  return lng >= VALIDATION_LIMITS.LONGITUDE_MIN && lng <= VALIDATION_LIMITS.LONGITUDE_MAX;
}

export function validateLatitude(lat: number): boolean {
  return lat >= VALIDATION_LIMITS.LATITUDE_MIN && lat <= VALIDATION_LIMITS.LATITUDE_MAX;
}

export function validateZoom(zoom: number): boolean {
  return zoom >= VALIDATION_LIMITS.ZOOM_MIN && zoom <= VALIDATION_LIMITS.ZOOM_MAX;
}

export function validateBearing(bearing: number): boolean {
  return bearing >= VALIDATION_LIMITS.BEARING_MIN && bearing <= VALIDATION_LIMITS.BEARING_MAX;
}

export function validatePitch(pitch: number): boolean {
  return pitch >= VALIDATION_LIMITS.PITCH_MIN && pitch <= VALIDATION_LIMITS.PITCH_MAX;
}

export function validateViewport(viewport: MapViewport): boolean {
  const [lng, lat] = viewport.center;
  return (
    validateLongitude(lng) &&
    validateLatitude(lat) &&
    validateZoom(viewport.zoom) &&
    validateBearing(viewport.bearing) &&
    validatePitch(viewport.pitch)
  );
}

export function formatCoordinates(lng: number, lat: number, precision: number = 4): string {
  return `${lng.toFixed(precision)}, ${lat.toFixed(precision)}`;
}