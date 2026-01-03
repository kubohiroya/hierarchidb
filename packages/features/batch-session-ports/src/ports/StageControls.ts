/**
 * ステージ実行の制御（pause/abort/並列度）。
 *
 * Worker 並列・中断/再開・進捗の共通契約として利用する。
 */
export interface StageControls {
  waitIfPaused?: () => Promise<void>;
  getSignal?: () => AbortSignal;
  maxConcurrent?: number;
  requestPause?: (message: string) => void | Promise<void>;
}

