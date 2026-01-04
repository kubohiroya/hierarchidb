/**
 * @file FullMapDisplay.tsx
 * @description Full-featured map display wrapper for layered resources
 */

import type React from 'react';
import type { MapLibreStyle } from '../types/maplibre-public.js';
import {
  ResourceLayerMap,
  type ResourceLayerMapProps,
  type ResourceVectorLayer,
} from './ResourceLayerMap.js';

type BaseMapStyleProps =
  | {
      mapStyleUrl: string;
      mapStyleObject?: never;
    }
  | {
      mapStyleObject: MapLibreStyle;
      mapStyleUrl?: never;
    };

export type FullMapDisplayProps = Omit<
  ResourceLayerMapProps,
  'vectorLayers' | 'mapStyleUrl' | 'mapStyleObject'
> &
  BaseMapStyleProps & {
    vectorLayers?: ResourceVectorLayer[];
  };

export const FullMapDisplay: React.FC<FullMapDisplayProps> = ({
  vectorLayers = [],
  ...props
}) => (
  <ResourceLayerMap
    vectorLayers={vectorLayers}
    {...props}
  />
);
