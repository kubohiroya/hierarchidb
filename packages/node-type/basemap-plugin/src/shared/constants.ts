/**
 * @file shared/constants.ts
 * @description BaseMap shared constants
 */

import type { MapViewport } from './types';

export const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.6917, 35.6895], // Tokyo
  zoom: 10,
  bearing: 0,
  pitch: 0
};

export const VALIDATION_LIMITS = {
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  ZOOM_MIN: 0,
  ZOOM_MAX: 24,
  BEARING_MIN: 0,
  BEARING_MAX: 360,
  PITCH_MIN: 0,
  PITCH_MAX: 60
} as const;

export const MAP_STYLE_PRESETS = {
  streets: 'Standard street map view',
  satellite: 'Satellite imagery view', 
  terrain: 'Topographical terrain view',
  dark: 'Dark theme for low-light viewing',
  light: 'Clean light theme',
  custom: 'Custom MapLibre style URL'
} as const;