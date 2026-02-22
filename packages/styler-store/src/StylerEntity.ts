import type { SpreadsheetEntityPayload, SpreadSheetDataSourceType } from '@hierarchidb/spreadsheet-store';
import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import type { MapLibreStyle } from '@hierarchidb/ui-map';

import type { StepData } from '@hierarchidb/plugin-base';

export type { SpreadSheetDataSourceType };

export type StyleType = 'choropleth' | 'points' | 'lines';
export type StylerValueType = 'number' | 'color';
export type StylerMappingMode = 'map-interpolate' | 'precomputed';

export type MapLibreStyleProperty =
  | 'fill-color'
  | 'fill-opacity'
  | 'line-color'
  | 'line-width'
  | 'line-opacity'
  | 'circle-color'
  | 'circle-radius'
  | 'circle-opacity'
  | 'text-color'
  | 'text-halo-color'
  | 'text-halo-width';

export type ColorAlgorithm = 'linear' | 'log' | 'quantile' | 'jenks' | 'equal';

export type ColorSpace = 'hsv' | 'rgb' | 'lab';
export type ColorScheme =
  | 'grayscale'
  | 'redgreen'
  | 'blueorange'
  | 'viridis'
  | 'magma'
  | 'custom';

export interface StyleKeyValue {
  nodeId: NodeId;
  key: string;
}

export interface ColorStyleKeyValue extends StyleKeyValue {
  color: string;
}

export interface ScalarStyleKeyValue extends StyleKeyValue {
  scalarValue: number;
}

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

export interface StylerMapping {
  /**
   * Legacy location; use StylerEntity.keyColumn instead.
   */
  keyColumn?: string;
  /**
   * Legacy location; use StylerEntity.valueColumn instead.
   */
  valueColumn?: string;
  styleType?: StyleType;
  targetProperty: MapLibreStyleProperty | null;
  targetOptionId?: string;
  featureIdProperty?: string;
  valueType?: StylerValueType;
  mappingMode?: StylerMappingMode;
  targetNumericValueRange?: {
    min?: number;
    max?: number;
  };
}

export interface StylerConfig {
  algorithm: ColorAlgorithm;
  colorSpace: ColorSpace;
  invertColors?: boolean;
  opacity?: number;
  colorScheme?: ColorScheme;
  nullHandling?: 'exclude' | 'zero';
  binCount?: number;
  // enabled?: boolean;

  min: number;
  max: number;
  outputMin: number;
  outputMax: number;

  //  HSV
  hueStart: number; // 0-360
  hueEnd: number; // 0-360
  saturation: number; // 0-1
  brightness: number; // 0-1

  //  RGB
  startColor?: string; // hex color
  endColor?: string; // hex color
}

export interface PropertyGroup {
  name: string;
  displayName: string;
  properties: MapLibreStyleProperty[];
}

export type StylerTablePrimitive = string | number | boolean | null | undefined;
export type StylerTableRow = Record<string, StylerTablePrimitive>;

export type StylerDialogData = Partial<StylerEntity>;

export interface TablePreviewProps {
  data: StylerTableRow[];
  config: StylerConfig;
  onColumnSelect?: (columnName: string, type: 'key' | 'value') => void;
}

export interface ColorCalculationResult {
  color: string; //  RGB/HSV/Hex
  opacity?: number;
  strokeWidth?: number;
  metadata?: {
    hue?: number;
    saturation?: number;
    brightness?: number;
    r?: number;
    g?: number;
    b?: number;
  };
}

export const StylerMappingDefault: StylerMapping = {
  targetProperty: null,
  valueType: 'color',
  mappingMode: 'map-interpolate',
}

export const StylerConfigDefault: StylerConfig = {
  algorithm: 'linear',
  colorSpace: 'hsv',
  invertColors: false,
  opacity: 1.0,
  colorScheme: 'grayscale',
  nullHandling: 'exclude',
  binCount: 256,
  min: 0,
  max: 100,
  outputMin: 1,
  outputMax: 8,
  hueStart: 0, // Red
  hueEnd: 120, // Green
  saturation: 0.8,
  brightness: 0.9,
};

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
  'line-width': {
    name: 'line-width',
    displayName: 'Line Width',
    category: 'line',
    type: 'number',
    defaultValue: 2,
    min: 0,
    max: 20,
    step: 0.5,
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

export const MAPLIBRE_PROPERTY_GROUPS: PropertyGroup[] = [
  {
    name: 'fill',
    displayName: 'Fill Properties',
    properties: ['fill-color', 'fill-opacity'],
  },
  {
    name: 'line',
    displayName: 'Line Properties',
    properties: ['line-color', 'line-width', 'line-opacity'],
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

export const STYLE_TYPE_OPTIONS: ReadonlyArray<{
  value: StyleType;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}> = [
  {
    value: 'choropleth',
    labelKey: 'styleSettings.styleType.options.choropleth',
    descriptionKey: 'styleSettings.styleType.descriptions.choropleth',
    icon: 'shape',
  },
  {
    value: 'points',
    labelKey: 'styleSettings.styleType.options.points',
    descriptionKey: 'styleSettings.styleType.descriptions.points',
    icon: 'location',
  },
  {
    value: 'lines',
    labelKey: 'styleSettings.styleType.options.lines',
    descriptionKey: 'styleSettings.styleType.descriptions.lines',
    icon: 'route',
  },
];

export type StylerStepData = StylerDialogData &
  StepData & {
  dataSource?: SpreadSheetDataSourceType;
  colorScheme?: string;
  opacity?: number;
  strokeWidth?: number;
  stylerConfig?: StylerConfig;
};

export interface StylerEntityPayload extends SpreadsheetEntityPayload {
  //  - spreadsheetMetadataId?: string (SpreadsheetEntity)
  //  - dataSource: object (SpreadsheetEntity)
  //  - filters?: object (SpreadsheetEntity)

  mapping: StylerMapping;
  config: StylerConfig;
  styleKeyValues?: {
    colors?: ColorStyleKeyValue[];
    scalars?: ScalarStyleKeyValue[];
  };

  colorScheme?: string;

  generatedStyle?: {
    maplibreStyleSpec: MapLibreStyle | Record<string, unknown>;
    colorMapping: Record<string, string>;
    lastUpdated: number;
  };

}

export type StylerEntity = PeerEntity<StylerEntityPayload>;

// Working copies live on TreeNode data/draftData; no dedicated worker store.

export interface StylerColorRule {
  column: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'range';
  value: unknown;
  maxValue?: unknown; // For range operator
  style: StylerStyle;
  label?: string;
}

export interface StylerStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}
