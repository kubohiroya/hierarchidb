/**
 * Shape Plugin - Main entry point
 * 3層アーキテクチャ統合エクスポート
 */

// Shared layer - 共通で使用される型・定数・メタデータ
export * from './shared';

// UI layer - UI環境専用
export * as UI from './ui';

// Worker layer - Worker環境専用
export * as Worker from './worker';

// Backward compatibility - 既存コードとの互換性
export { ShapeMetadata } from './shared/metadata';
export type { ShapeEntity, CreateShapeData, UpdateShapeData } from './shared/types';
export type { ShapeAPI } from './shared/api';