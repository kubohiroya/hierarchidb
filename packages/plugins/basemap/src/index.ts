/**
 * BaseMapプラグインのメインエクスポート
 */

// 設定のエクスポート
export { basemapPlugin } from '../plugin.config';

// 型定義のエクスポート
export type { BaseMapEntity, BaseMapWorkingCopy, TileCache } from './types';

// ハンドラーのエクスポート
export { BaseMapEntityHandler } from './handlers/BaseMapEntityHandler';

// ルートコンポーネントのエクスポート (temporarily disabled due to MUI dependencies)
// export { default as IndexView } from './routes/_index';
// export { default as EditView } from './routes/edit';

// プラグイン情報
export const PLUGIN_INFO = {
  id: 'com.example.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
} as const;
