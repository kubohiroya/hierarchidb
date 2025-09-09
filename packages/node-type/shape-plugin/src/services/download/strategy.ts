import type { BatchTaskLike } from '../../types/BatchTaskLike';

export interface IShapeDownloadStrategy {
  readonly id: string;

  supports(task: BatchTaskLike): boolean;

  download(task: BatchTaskLike): Promise<{ text: string; sizeBytes?: number; featureCount?: number }>;
}

