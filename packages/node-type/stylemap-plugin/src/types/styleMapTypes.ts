/**
 * @file styleMapTypes.ts
 * @description StyleMap plugin type definitions
 * 【機能概要】: StyleMap設定に関する型定義
 * 【実装方針】: eria-cartographの型定義をHierarchiDBに適応
 * 🟢 信頼性レベル: 型定義により型安全性を確保
 */

/**
 * 【型定義】: MapLibre style propertyの種類
 * 🟢 信頼性レベル: MapLibre GL JS仕様に準拠
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
 * 【型定義】: カラーアルゴリズムの種類
 * 🟢 信頼性レベル: 2種類の標準的なカラースペース
 */
export type ColorAlgorithm = 'linear' | 'quantile' | 'jenks' | 'equal';

/**
 * 【型定義】: カラースペースの種類
 * 🟢 信頼性レベル: HSVとRGB両対応
 */
export type ColorSpace = 'hsv' | 'rgb' | 'lab';

/**
 * 【型定義】: StyleMapのマッピング設定
 * 🟢 信頼性レベル: 数値範囲とカラー範囲のマッピング
 */
export interface StyleMapMapping {
  // 数値範囲
  min: number;
  max: number;

  // HSVカラースペース設定
  hueStart: number; // 0-360
  hueEnd: number; // 0-360
  saturation: number; // 0-1
  brightness: number; // 0-1

  // RGBカラースペース設定（オプション）
  startColor?: string; // hex color
  endColor?: string; // hex color
}

/**
 * 【型定義】: StyleMap設定全体
 * 🟢 信頼性レベル: 完全な設定構造
 */
export interface StyleMapConfig {
  // 対象となるスタイルプロパティ
  targetProperty: MapLibreStyleProperty | null;

  // カラーアルゴリズム
  algorithm: ColorAlgorithm;

  // カラースペース
  colorSpace: ColorSpace;

  // マッピング設定
  mapping: StyleMapMapping;

  // 選択されたカラム情報
  keyColumn?: string;
  valueColumn?: string;

  // その他のオプション
  invertColors?: boolean;
  opacity?: number;
  enabled?: boolean;
}

/**
 * 【型定義】: MapLibreプロパティのメタデータ
 * 🟢 信頼性レベル: プロパティごとの設定情報
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
 * 【型定義】: プロパティグループ
 * 🟢 信頼性レベル: UIでのグループ表示用
 */
export interface PropertyGroup {
  name: string;
  displayName: string;
  properties: MapLibreStyleProperty[];
}

/**
 * 【型定義】: テーブルプレビュー用プロパティ
 * 🟢 信頼性レベル: データプレビューUI用
 */
export interface TablePreviewProps {
  data: Array<Record<string, any>>;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
  config: StyleMapConfig;
  onColumnSelect?: (columnName: string, type: 'key' | 'value') => void;
}

/**
 * 【型定義】: 色計算結果
 * 🟢 信頼性レベル: 色計算のレスポンス型
 */
export interface ColorCalculationResult {
  color: string; // RGB/HSV/Hex形式
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
 * 【定数】: StyleMapのデフォルト設定
 * 🟢 信頼性レベル: 標準的なデフォルト値
 */
export const StyleMapConfigDefault: StyleMapConfig = {
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
 * 【定数】: MapLibreプロパティのメタデータ定義
 * 🟢 信頼性レベル: MapLibre仕様に基づく
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
 * 【定数】: プロパティグループ定義
 * 🟢 信頼性レベル: UI表示用のグループ化
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
