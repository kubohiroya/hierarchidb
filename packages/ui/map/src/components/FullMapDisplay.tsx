/**
 * @file FullMapDisplay.tsx
 * @description Full-featured map display wrapper for layered resources
 */

import type React from 'react';
import {
  ResourceLayerMap,
  type ResourceLayerMapProps,
  type ResourceVectorLayer,
} from './ResourceLayerMap.js';

export type FullMapDisplayProps = Omit<ResourceLayerMapProps, 'vectorLayers'> & {
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
