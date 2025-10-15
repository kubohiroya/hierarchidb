/**
  * @file stylerTypes.ts
 * @description Styler plugin type definitions
 * : Styler
 * : eria-cartographHierarchiDB
 * :
  */

/**
  * : MapLibre style property
 * : MapLibre GL JS
  */
export type MapLibreStyleProperty =
  | 'fill-color'
  | 'fill-opacity'
  | 'line-color'
  | 'line-opacity'
  | 'circle-color'
  | 'circle-radius'
  | 'circle-opacity'
  | 'text-color'
  | 'text-halo-color'
  | 'text-halo-width';

/**
  * :
 * : 2
  */
export type ColorAlgorithm = 'linear' | 'quantile' | 'jenks' | 'equal';

/**
  * :
 * : HSVRGB
  */
export type ColorSpace = 'hsv' | 'rgb' | 'lab';

/**
  * : Styler
 * :
  */
export interface StylerMapping {
  min: number;
  max: number;

  //  HSV
  hueStart: number; // 0-360
  hueEnd: number; // 0-360
  saturation: number; // 0-1
  brightness: number; // 0-1

  //  RGB
  startColor?: string; // hex color
  endColor?: string; // hex color
}

/**
  * : Styler
 * :
  */
export interface StylerConfig {
  targetProperty: MapLibreStyleProperty | null;

  algorithm: ColorAlgorithm;

  colorSpace: ColorSpace;

  mapping: StylerMapping;

  keyColumn?: string;
  valueColumn?: string;
  /** Legacy alias retained for backwards compatibility */
  selectedKeyColumn?: string;
  /** Legacy alias retained for backwards compatibility */
  selectedValueColumn?: string;

  invertColors?: boolean;
  opacity?: number;
  enabled?: boolean;
}

/**
  * : MapLibre
 * :
  */
export interface MapLibrePropertyMetadata {
  name: string;
  displayName: string;
  category: 'fill' | 'line' | 'circle' | 'text';
  type: 'color' | 'number';
  defaultValue: string | number;
  min?: number;
  max?: number;
  step?: number;
}

/**
  * :
 * : UI
  */
export interface PropertyGroup {
  name: string;
  displayName: string;
  properties: MapLibreStyleProperty[];
}

/**
  * :
 * : UI
  */
export interface TablePreviewProps {
  data: Array<Record<string, any>>;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  config: StylerConfig;
  onColumnSelect?: (columnName: string, type: 'key' | 'value') => void;
}

/**
  * :
 * :
  */
export interface ColorCalculationResult {
  color: string; //  RGB/HSV/Hex
  opacity?: number;
  metadata?: {
    hue?: number;
    saturation?: number;
    brightness?: number;
    r?: number;
    g?: number;
    b?: number;
  };
}

/**
  * : Styler
 * :
  */
export const StylerConfigDefault: StylerConfig = {
  targetProperty: null,
  algorithm: 'linear',
  colorSpace: 'hsv',
  mapping: {
    min: 0,
    max: 100,
    hueStart: 0, // Red
    hueEnd: 120, // Green
    saturation: 0.8,
    brightness: 0.9,
  },
  invertColors: false,
  opacity: 1.0,
  enabled: true,
};

/**
 * Peer payload stored for styler nodes. Always provide schemaVersion and
 * include optional metadata for UI state persistence.
 */
export interface StylerPeerData {
  schemaVersion: 1;
  lastAppliedConfig?: StylerConfig;
  metadata?: Record<string, unknown>;
}

/**
  * : MapLibre
 * : MapLibre
  */
export const MAPLIBRE_PROPERTY_METADATA: Record<MapLibreStyleProperty, MapLibrePropertyMetadata> = {
  'fill-color': {
    name: 'fill-color',
    displayName: 'Fill Color',
    category: 'fill',
    type: 'color',
    defaultValue: '#000000',
  },
  'fill-opacity': {
    name: 'fill-opacity',
    displayName: 'Fill Opacity',
    category: 'fill',
    type: 'number',
    defaultValue: 1.0,
    min: 0,
    max: 1,
    step: 0.1,
  },
  'line-color': {
    name: 'line-color',
    displayName: 'Line Color',
    category: 'line',
    type: 'color',
    defaultValue: '#000000',
  },
  'line-opacity': {
    name: 'line-opacity',
    displayName: 'Line Opacity',
    category: 'line',
    type: 'number',
    defaultValue: 1.0,
    min: 0,
    max: 1,
    step: 0.1,
  },
  'circle-color': {
    name: 'circle-color',
    displayName: 'Circle Color',
    category: 'circle',
    type: 'color',
    defaultValue: '#000000',
  },
  'circle-radius': {
    name: 'circle-radius',
    displayName: 'Circle Radius',
    category: 'circle',
    type: 'number',
    defaultValue: 5,
    min: 0,
    max: 50,
    step: 1,
  },
  'circle-opacity': {
    name: 'circle-opacity',
    displayName: 'Circle Opacity',
    category: 'circle',
    type: 'number',
    defaultValue: 1.0,
    min: 0,
    max: 1,
    step: 0.1,
  },
  'text-color': {
    name: 'text-color',
    displayName: 'Text Color',
    category: 'text',
    type: 'color',
    defaultValue: '#000000',
  },
  'text-halo-color': {
    name: 'text-halo-color',
    displayName: 'Text Halo Color',
    category: 'text',
    type: 'color',
    defaultValue: '#FFFFFF',
  },
  'text-halo-width': {
    name: 'text-halo-width',
    displayName: 'Text Halo Width',
    category: 'text',
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 10,
    step: 0.5,
  },
};

/**
  * :
 * : UI
  */
export const MAPLIBRE_PROPERTY_GROUPS: PropertyGroup[] = [
  {
    name: 'fill',
    displayName: 'Fill Properties',
    properties: ['fill-color', 'fill-opacity'],
  },
  {
    name: 'line',
    displayName: 'Line Properties',
    properties: ['line-color', 'line-opacity'],
  },
  {
    name: 'circle',
    displayName: 'Circle Properties',
    properties: ['circle-color', 'circle-radius', 'circle-opacity'],
  },
  {
    name: 'text',
    displayName: 'Text Properties',
    properties: ['text-color', 'text-halo-color', 'text-halo-width'],
  },
];
