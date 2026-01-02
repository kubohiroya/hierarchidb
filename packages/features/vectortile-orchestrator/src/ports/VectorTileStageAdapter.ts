import type { ProgressInfo, VectorTileTask } from './sharedTypes.js';
import type { StageControls } from './StageControls.js';

export interface VectorTileStageAdapterResult {
  processed: number;
  failed: number;
}

/**
 * Vectortile の実行実体（worker 呼び出し等）を隠蔽する adapter。
 *
 * 共通化のため、Task / Progress の型はジェネリクスで受け取る。
 */
export interface VectorTileStageAdapter<TTask = VectorTileTask, TProgress = ProgressInfo> {
  process(
    tasks: TTask[],
    onProgress: (p: TProgress) => void,
    controls?: StageControls,
  ): Promise<VectorTileStageAdapterResult>;

  clearFeatureCache?(nodeId: string): void;
}
