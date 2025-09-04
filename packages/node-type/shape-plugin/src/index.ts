/**
 * Shape Plugin - Main entry point
 * 3層アーキテクチャ統合エクスポート
 */

// Shared layer - 共通で使用される型・定数・メタデータ
export * from './shared';

// UI layer is internal to app; not exported in package API

// Worker layer exports are internal; public API deferred until types are stabilized

// Extension exports (for plugin extension system)
// Extension (UI) exports omitted from public API for now

// Backward compatibility - 既存コードとの互換性
export { ShapeMetadata } from './shared/metadata';
export type { ShapeEntity, CreateShapeData, UpdateShapeData } from './shared/types';
export type { ShapeAPI } from './shared/api';

// Batch processing exports are temporarily internal-only until type contracts are stabilized
