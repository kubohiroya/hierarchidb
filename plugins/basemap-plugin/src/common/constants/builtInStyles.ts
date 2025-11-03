/**
 * @file builtInStyles.ts
 * @description Built-in map style definitions and URLs
 */

export interface BuiltInStyle {
  id: string;
  name: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  attribution: string;
  free: boolean;
  requiresApiKey: boolean;
}

/**
 * Built-in map styles available without API keys
 * These are free, reliable map tile services
 */
export const BUILT_IN_STYLES = {
  streets: {
    id: 'streets',
    name: 'Streets',
    description: 'Standard street map with roads, labels, and points of interest',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    thumbnailUrl: 'https://carto.com/help/images/building-maps/basemaps/voyager.png',
    attribution: '© CARTO © OpenStreetMap contributors',
    free: true,
    requiresApiKey: false,
  },

  satellite: {
    id: 'satellite',
    name: 'Satellite',
    description: 'Satellite imagery view',
    // Using a demo/fallback URL - in production, this would need an API key
    url: 'https://demotiles.maplibre.org/style.json',
    attribution: '© MapLibre © OpenStreetMap contributors',
    free: false,
    requiresApiKey: true,
  },

  terrain: {
    id: 'terrain',
    name: 'Terrain',
    description: 'Topographical map with elevation contours',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    attribution: '© CARTO © OpenStreetMap contributors',
    free: true,
    requiresApiKey: false,
  },

  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Dark theme optimized for data visualization',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    thumbnailUrl: 'https://carto.com/help/images/building-maps/basemaps/dark-matter.png',
    attribution: '© CARTO © OpenStreetMap contributors',
    free: true,
    requiresApiKey: false,
  },

  light: {
    id: 'light',
    name: 'Light',
    description: 'Minimal light theme perfect for overlaying data',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    thumbnailUrl: 'https://carto.com/help/images/building-maps/basemaps/positron.png',
    attribution: '© CARTO © OpenStreetMap contributors',
    free: true,
    requiresApiKey: false,
  },
} as const satisfies Record<string, BuiltInStyle>;

/**
 * Additional preset styles that require API keys
 * These are documented but not directly usable without configuration
 */
export const PREMIUM_STYLES = {
  mapbox_streets: {
    id: 'mapbox_streets',
    name: 'Mapbox Streets',
    description: 'High-quality street map (requires Mapbox API key)',
    url: 'mapbox://styles/mapbox/streets-v12',
    requiresApiKey: true,
    apiKeyProvider: 'mapbox',
  },

  mapbox_satellite: {
    id: 'mapbox_satellite',
    name: 'Mapbox Satellite',
    description: 'High-resolution satellite imagery (requires Mapbox API key)',
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    requiresApiKey: true,
    apiKeyProvider: 'mapbox',
  },

  maptiler_basic: {
    id: 'maptiler_basic',
    name: 'MapTiler Basic',
    description: 'Clean basic map (requires MapTiler API key)',
    url: 'https://api.maptiler.com/maps/basic-v2/style.json?key={key}',
    requiresApiKey: true,
    apiKeyProvider: 'maptiler',
  },

  maptiler_topo: {
    id: 'maptiler_topo',
    name: 'MapTiler Topo',
    description: 'Topographic map with contours (requires MapTiler API key)',
    url: 'https://api.maptiler.com/maps/topo-v2/style.json?key={key}',
    requiresApiKey: true,
    apiKeyProvider: 'maptiler',
  },
};

/**
 * Get style URL by style type
 * Falls back to streets style if not found
 */
export function getBuiltInStyleUrl(
  styleType: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom'
): string {
  if (styleType === 'custom') {
    // Custom style should provide its own URL
    return BUILT_IN_STYLES.streets.url;
  }

  const style = BUILT_IN_STYLES[styleType as keyof typeof BUILT_IN_STYLES];
  return style?.url || BUILT_IN_STYLES.streets.url;
}

/**
 * Get attribution text for a style
 */
export function getStyleAttribution(
  styleType: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom'
): string {
  if (styleType === 'custom') {
    return '© Map data contributors';
  }

  const style = BUILT_IN_STYLES[styleType as keyof typeof BUILT_IN_STYLES];
  return style?.attribution || BUILT_IN_STYLES.streets.attribution;
}

/**
 * Check if a style requires an API key
 */
export function styleRequiresApiKey(
  styleType: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom'
): boolean {
  if (styleType === 'custom') {
    return false; // Depends on the custom URL
  }

  const style = BUILT_IN_STYLES[styleType as keyof typeof BUILT_IN_STYLES];
  return style?.requiresApiKey || false;
}

/**
 * Example custom style configurations
 */
export const CUSTOM_STYLE_EXAMPLES = {
  minimal: {
    version: 8,
    name: 'Minimal',
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },

  watercolor: {
    version: 8,
    name: 'Watercolor',
    sources: {
      stamen: {
        type: 'raster',
        tiles: [
          'https://watercolormaps.collection.cooperhewitt.org/tile/watercolor/{z}/{x}/{y}.jpg',
        ],
        tileSize: 256,
        attribution: '© Stamen Design',
      },
    },
    layers: [
      {
        id: 'watercolor',
        type: 'raster',
        source: 'stamen',
      },
    ],
  },
};
