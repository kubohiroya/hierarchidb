/**
 * Plugin Shapes 定数定義
 * 【パフォーマンス改善】: マジックナンバーの排除
 * ⚡ パフォーマンスレベル: 定数の一元管理
 */

// 【セキュリティ制限】: ファイルサイズとデータ制限 🛡️
export const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_FEATURES: 10000,
  MAX_STRING_LENGTH: {
    NAME: 100,
    DESCRIPTION: 1000,
  },
} as const;

// 【レイヤー設定】: デフォルト値 🟢
export const DEFAULT_LAYER_CONFIG = {
  VISIBLE: true,
  OPACITY: 0.8,
  Z_INDEX: 1,
  INTERACTIVE: true,
  MIN_ZOOM: 0,
  MAX_ZOOM: 24,
} as const;

// 【スタイル設定】: デフォルトスタイル 🟢
export const DEFAULT_STYLES = {
  POLYGON: {
    fillColor: '#3388ff',
    fillOpacity: 0.6,
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  LINE: {
    color: '#ff4444',
    width: 2,
    opacity: 1.0,
    pattern: 'solid' as const,
  },
  POINT: {
    radius: 5,
    fillColor: '#ff6600',
    strokeColor: '#cc4400',
    strokeWidth: 1,
  },
} as const;

// 【GeoJSON設定】: 初期値とCRS 🟢
export const GEOJSON_CONSTANTS = {
  EMPTY_FEATURE_COLLECTION: '{"type":"FeatureCollection","features":[]}',
  DEFAULT_CRS: 'EPSG:4326',
  COORDINATE_BOUNDS: {
    MIN_LONGITUDE: -180,
    MAX_LONGITUDE: 180,
    MIN_LATITUDE: -90,
    MAX_LATITUDE: 90,
  },
} as const;

// 【バッチ処理】: デフォルト設定 🟡
export const BATCH_PROCESSING = {
  DEFAULT_CONCURRENT: 4,
  DEFAULT_TIMEOUT: 30000,
  DEFAULT_RETRY_COUNT: 3,
} as const;
