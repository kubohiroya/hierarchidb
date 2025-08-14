/**
 * @file StyleMapConfig.ts
 * @description StyleMap configuration type definitions for color mapping algorithms
 * References:
 * - docs/spec/plugin-stylemap-requirements.md (REQ-003, REQ-301, REQ-302)
 * - ../eria-cartograph/app0/src/domains/resources/stylemap/types/StyleMapConfig.tsx
 */

/**
 * MapLibre GL style properties that can be styled with color mapping
 */
export type MapLibreStyleProperty =
  // Fill properties
  | 'fill-color'
  | 'fill-opacity'
  | 'fill-outline-color'

  // Line properties
  | 'line-color'
  | 'line-opacity'
  | 'line-width'
  | 'line-blur'
  | 'line-gap-width'

  // Circle properties
  | 'circle-color'
  | 'circle-radius'
  | 'circle-stroke-color'
  | 'circle-stroke-width'
  | 'circle-stroke-opacity'
  | 'circle-opacity'

  // Symbol properties
  | 'text-color'
  | 'text-halo-color'
  | 'text-opacity'
  | 'icon-color'
  | 'icon-halo-color'
  | 'icon-opacity'

  // Heatmap properties
  | 'heatmap-color'
  | 'heatmap-intensity'
  | 'heatmap-opacity'
  | 'heatmap-radius'
  | 'heatmap-weight'

  // Fill extrusion properties
  | 'fill-extrusion-color'
  | 'fill-extrusion-height'
  | 'fill-extrusion-opacity';

/**
 * Color mapping algorithms supported by StyleMap
 */
export type ColorMappingAlgorithm =
  | 'linear' // Linear interpolation between min/max values
  | 'logarithmic' // Logarithmic scale mapping
  | 'quantile' // Quantile-based distribution
  | 'categorical'; // Discrete categorical mapping

/**
 * Color space for interpolation
 */
export type ColorSpace =
  | 'rgb' // RGB color space interpolation
  | 'hsv'; // HSV color space interpolation (recommended)

/**
 * Color mapping configuration
 */
export interface ColorMappingConfig {
  /** Minimum value in the data range */
  min: number;
  /** Maximum value in the data range */
  max: number;
  /** Starting hue value (0-1, where 0=red, 0.33=green, 0.67=blue) */
  hueStart: number;
  /** Ending hue value (0-1) */
  hueEnd: number;
  /** Saturation value (0-1, where 0=grayscale, 1=full saturation) */
  saturation: number;
  /** Brightness/Value (0-1, where 0=black, 1=full brightness) */
  brightness: number;
}

/**
 * Complete StyleMap configuration
 * Defines how data values are mapped to visual styles
 */
export interface StyleMapConfig {
  /** Color mapping algorithm to use */
  algorithm: ColorMappingAlgorithm;

  /** Color space for interpolation */
  colorSpace: ColorSpace;

  /** Color mapping parameters */
  mapping: ColorMappingConfig;

  /** Target MapLibre GL style property */
  targetProperty: MapLibreStyleProperty;

  /** Legacy support - use targetProperty instead */
  strokeWidth?: number;
}

/**
 * Default StyleMap configuration
 */
export const DEFAULT_STYLEMAP_CONFIG: StyleMapConfig = {
  algorithm: 'linear',
  colorSpace: 'hsv',
  mapping: {
    min: 0,
    max: 100,
    hueStart: 0.0, // Red
    hueEnd: 0.67, // Blue
    saturation: 0.8, // High saturation
    brightness: 0.9, // High brightness
  },
  targetProperty: 'fill-color',
};

/**
 * Predefined color mapping presets
 */
export const COLOR_MAPPING_PRESETS: Record<string, Partial<ColorMappingConfig>> = {
  // Temperature-like (blue to red)
  heat: {
    hueStart: 0.67, // Blue
    hueEnd: 0.0, // Red
    saturation: 0.8,
    brightness: 0.9,
  },

  // Traffic-like (green to red)
  traffic: {
    hueStart: 0.33, // Green
    hueEnd: 0.0, // Red
    saturation: 0.8,
    brightness: 0.8,
  },

  // Ocean depth (light blue to dark blue)
  ocean: {
    hueStart: 0.55, // Light blue
    hueEnd: 0.65, // Dark blue
    saturation: 0.7,
    brightness: 0.9,
  },

  // Forest (light green to dark green)
  forest: {
    hueStart: 0.25, // Light green
    hueEnd: 0.35, // Dark green
    saturation: 0.6,
    brightness: 0.8,
  },

  // Sunset (yellow to red)
  sunset: {
    hueStart: 0.15, // Yellow
    hueEnd: 0.0, // Red
    saturation: 0.9,
    brightness: 0.9,
  },

  // Grayscale (black to white)
  grayscale: {
    hueStart: 0.0,
    hueEnd: 0.0,
    saturation: 0.0, // No color
    brightness: 0.9,
  },
};

/**
 * MapLibre style property metadata
 */
export interface StylePropertyMetadata {
  property: MapLibreStyleProperty;
  category: 'fill' | 'line' | 'circle' | 'symbol' | 'heatmap' | 'fill-extrusion';
  valueType: 'color' | 'number' | 'opacity';
  description: string;
  unit?: string;
  range?: [number, number];
}

/**
 * MapLibre style property definitions
 */
export const MAPLIBRE_STYLE_PROPERTIES: StylePropertyMetadata[] = [
  // Fill properties
  {
    property: 'fill-color',
    category: 'fill',
    valueType: 'color',
    description: 'The color of the filled part of this layer',
  },
  {
    property: 'fill-opacity',
    category: 'fill',
    valueType: 'opacity',
    description: 'The opacity of the entire fill layer',
    range: [0, 1],
  },
  {
    property: 'fill-outline-color',
    category: 'fill',
    valueType: 'color',
    description: 'The outline color of the fill',
  },

  // Line properties
  {
    property: 'line-color',
    category: 'line',
    valueType: 'color',
    description: 'The color with which the line will be drawn',
  },
  {
    property: 'line-opacity',
    category: 'line',
    valueType: 'opacity',
    description: 'The opacity at which the line will be drawn',
    range: [0, 1],
  },
  {
    property: 'line-width',
    category: 'line',
    valueType: 'number',
    description: 'Stroke thickness',
    unit: 'pixels',
    range: [0, Infinity],
  },

  // Circle properties
  {
    property: 'circle-color',
    category: 'circle',
    valueType: 'color',
    description: 'The fill color of the circle',
  },
  {
    property: 'circle-radius',
    category: 'circle',
    valueType: 'number',
    description: 'Circle radius',
    unit: 'pixels',
    range: [0, Infinity],
  },
  {
    property: 'circle-stroke-color',
    category: 'circle',
    valueType: 'color',
    description: 'The stroke color of the circle',
  },
  {
    property: 'circle-stroke-width',
    category: 'circle',
    valueType: 'number',
    description: "The width of the circle's stroke",
    unit: 'pixels',
    range: [0, Infinity],
  },
  {
    property: 'circle-opacity',
    category: 'circle',
    valueType: 'opacity',
    description: 'The opacity at which the circle will be drawn',
    range: [0, 1],
  },
];

/**
 * Validate StyleMap configuration
 */
export function validateStyleMapConfig(config: StyleMapConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate algorithm
  const validAlgorithms: ColorMappingAlgorithm[] = [
    'linear',
    'logarithmic',
    'quantile',
    'categorical',
  ];
  if (!validAlgorithms.includes(config.algorithm)) {
    errors.push(
      `Invalid algorithm: ${config.algorithm}. Must be one of: ${validAlgorithms.join(', ')}`
    );
  }

  // Validate color space
  const validColorSpaces: ColorSpace[] = ['rgb', 'hsv'];
  if (!validColorSpaces.includes(config.colorSpace)) {
    errors.push(
      `Invalid colorSpace: ${config.colorSpace}. Must be one of: ${validColorSpaces.join(', ')}`
    );
  }

  // Validate mapping configuration
  const { mapping } = config;

  if (mapping.min >= mapping.max) {
    errors.push('Mapping min value must be less than max value');
  }

  if (mapping.hueStart < 0 || mapping.hueStart > 1) {
    errors.push('Mapping hueStart must be between 0 and 1');
  }

  if (mapping.hueEnd < 0 || mapping.hueEnd > 1) {
    errors.push('Mapping hueEnd must be between 0 and 1');
  }

  if (mapping.saturation < 0 || mapping.saturation > 1) {
    errors.push('Mapping saturation must be between 0 and 1');
  }

  if (mapping.brightness < 0 || mapping.brightness > 1) {
    errors.push('Mapping brightness must be between 0 and 1');
  }

  // Validate target property
  const validProperties = MAPLIBRE_STYLE_PROPERTIES.map((p) => p.property);
  if (!validProperties.includes(config.targetProperty)) {
    errors.push(
      `Invalid targetProperty: ${config.targetProperty}. Must be one of the supported MapLibre properties`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create a StyleMap configuration with validation
 */
export function createStyleMapConfig(overrides: Partial<StyleMapConfig> = {}): StyleMapConfig {
  const config: StyleMapConfig = {
    ...DEFAULT_STYLEMAP_CONFIG,
    ...overrides,
    mapping: {
      ...DEFAULT_STYLEMAP_CONFIG.mapping,
      ...overrides.mapping,
    },
  };

  const validation = validateStyleMapConfig(config);
  if (!validation.isValid) {
    throw new Error(`Invalid StyleMap configuration: ${validation.errors.join(', ')}`);
  }

  return config;
}

/**
 * Apply a color mapping preset to a configuration
 */
export function applyColorPreset(
  config: StyleMapConfig,
  presetName: keyof typeof COLOR_MAPPING_PRESETS
): StyleMapConfig {
  const preset = COLOR_MAPPING_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown color preset: ${presetName}`);
  }

  return {
    ...config,
    mapping: {
      ...config.mapping,
      ...preset,
    },
  };
}

/**
 * Get style property metadata by property name
 */
export function getStylePropertyMetadata(
  property: MapLibreStyleProperty
): StylePropertyMetadata | undefined {
  return MAPLIBRE_STYLE_PROPERTIES.find((p) => p.property === property);
}

/**
 * Get all style properties by category
 */
export function getStylePropertiesByCategory(
  category: StylePropertyMetadata['category']
): StylePropertyMetadata[] {
  return MAPLIBRE_STYLE_PROPERTIES.filter((p) => p.category === category);
}
