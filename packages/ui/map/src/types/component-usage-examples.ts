/**
 * @file component-usage-examples.ts
 * @description Usage examples showing the unified API across all map components
 */

import type { MapLibreMapProps } from '../components/MapLibreMap.js';
import type { MapWithVectorTilesProps } from '../components/MapWithVectorTiles.js';
import type { VectorTileLayerProps } from '../components/VectorTileLayer.js';

/**
 * UNIFIED USAGE EXAMPLES
 *
 * The following examples show how the unified props design creates
 * consistent and intuitive APIs across all map components
 */

// ========================
// 1. BASIC MAP USAGE - Now Identical Across Components
// ========================

// @ts-ignore - Example only
const basicMapLibreConfig: MapLibreMapProps = {
  initialViewState: { longitude: 139.7, latitude: 35.7, zoom: 10 },
  onLoad: (_map) => console.log('Map loaded'),
  onViewStateChange: (viewState) => console.log('View changed', viewState),
  onClick: (event) => console.log('Map clicked', event),
};

// @ts-ignore - Example only
const basicVectorTilesConfig: MapWithVectorTilesProps = {
  // SAME base props as MapLibreMap - no learning curve!
  initialViewState: { longitude: 139.7, latitude: 35.7, zoom: 10 },
  onLoad: (_map) => console.log('Map loaded'),           // NOT onMapLoad
  onViewStateChange: (viewState) => console.log('View changed', viewState),
  onClick: (event) => console.log('Map clicked', event), // NOT onMapClick

  // Plus vector tile specific props
  dbName: 'my-tiles',
  nodeId: 'region-123',
};

// ========================
// 2. ADVANCED CONFIGURATION - Consistent Structure
// ========================

// @ts-ignore - Example only
const advancedConfig: MapWithVectorTilesProps = {
  // Base map configuration (consistent with MapLibreMap)
  initialViewState: { longitude: 139.7, latitude: 35.7, zoom: 10 },
  mapStyle: 'mapbox://styles/mapbox/streets-v11',
  width: 800,
  height: 600,
  mapOptions: {
    dragRotate: false,

  },

  // Event handlers (unified naming)
  onLoad: (_map) => {
    // Consistent callback name across all components
    console.log('Map ready');
  },

  // Vector tile data source (clearly separated concern)
  dbName: 'tokyo-districts',
  nodeId: 'ward-shibuya',

  // Layer configuration (unified from old LayerOptions)
  layerConfig: {
    layerId: 'district-boundaries',
    layerType: 'fill',
    paint: {
      'fill-color': '#ff6b6b',
      'fill-opacity': 0.6,
    },
    minzoom: 8,
    maxzoom: 16,
  },
};

// ========================
// 3. MIGRATION FROM OLD API
// ========================

/* 
// OLD API (inconsistent):
<MapLibreMap 
  onLoad={handleLoad}
  onClick={handleClick}
  height="400px"
/>

<MapWithVectorTiles 
  onMapLoad={handleLoad}     // Different name!
  onMapClick={handleClick}   // Different name! 
  height="500px"             // Different default!
  layerOptions={{...}}       // Mixed concerns
/>

// NEW API (consistent):
*/
// @ts-ignore - Example only
const unifiedProps = {
  // Same event handlers across all components
  onLoad: (_map: any) => console.log('loaded'),
  onClick: (_event: any) => console.log('clicked'),

  // Same dimensions and defaults
  height: '400px', // or omit to use DEFAULT_MAP_CONFIG.dimensions.height

  // Clear separation of concerns
  layerConfig: { /* display config */ },
  dbName: 'tiles', nodeId: 'node123', // data source config
};

/**
 * BENEFITS OF THE UNIFIED DESIGN:
 *
 * 1. **Learning Once, Use Everywhere**
 *    - Same prop names across MapLibreMap and MapWithVectorTiles
 *    - No need to remember onLoad vs onMapLoad
 *
 * 2. **Consistent Defaults**
 *    - All components use DEFAULT_MAP_CONFIG
 *    - No more 400px vs 500px height confusion
 *
 * 3. **Clear Separation of Concerns**
 *    - Base map props: dimensions, events, styling
 *    - Data source props: dbName, nodeId, tileDataProvider
 *    - Layer config props: paint, layout, filters
 *
 * 4. **Type Safety & IntelliSense**
 *    - Shared interfaces prevent typos
 *    - Better autocompletion across components
 *
 * 5. **Easier Component Migration**
 *    - Switch from MapLibreMap to MapWithVectorTiles
 *    - Only need to add vector tile specific props
 *    - All base functionality remains identical
 */

export type {
  MapLibreMapProps,
  MapWithVectorTilesProps,
  VectorTileLayerProps,
};