export type ProcessingStage = string;

/**
 * 共通の最小進捗 shape。
 *
 * plugin 固有の progress 型は、この型を拡張して良い。
 */
export interface ProgressInfoBase {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
}
