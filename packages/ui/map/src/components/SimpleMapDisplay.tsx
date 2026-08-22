/**
 * @file SimpleMapDisplay.tsx
 * @description Minimal map display wrapper for consistent defaults
 */

import type React from 'react';
import { DEFAULT_MAP_CONFIG } from '~/types/unified-map-props';
import { MapLibreMap, type MapLibreMapProps } from './MapLibreMap.js';

export type SimpleMapDisplayProps = MapLibreMapProps;

export const SimpleMapDisplay: React.FC<SimpleMapDisplayProps> = ({
  mapOptions = DEFAULT_MAP_CONFIG.interactionOptions,
  ...props
}) => <MapLibreMap mapOptions={mapOptions} {...props} />;
