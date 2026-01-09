import type { NodeId } from '@hierarchidb/common-types';
import type { StageHandler } from './runner.js';
import type { TaskQueueRecord, VtTaskQueueDb } from './task/taskQueue.js';
import type { VtShapeDb } from '@hierarchidb/vt-shape-store';
import type { VtDb } from '@hierarchidb/vt-store';

export type BandConfig = {
  bandId: number;
  zMin: number;
  zMax: number;
  zBase: number;
};

export type TransformStageConfig = {
  toleranceK: number;
  tileIndex: {
    buffer: number;
    extent: number;
    promoteId?: string;
  };
};

export type VtStageConfig = {
  extent: number;
  buffer: number;
  tileSize: number;
  vtSimplificationTolerance: number;
  boundaryDedupe: boolean;
  layers: string[];
  layerSetName: string;
};

export type TransformTaskInput = {
  stage1BufferId: string;
  bandId: number;
  domainType: 'shape' | 'route';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  adminLevel?: number;
};

export type VtTaskInput = {
  bandId: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  domainType: 'shape' | 'route';
  sourceKey: string;
};

export type TransformStageContext = {
  shapeStore: VtShapeDb;
  transformConfig: TransformStageConfig;
  bands: BandConfig[];
  maxBand3Reservations: number;
};

export type VtStageContext = {
  shapeStore: VtShapeDb;
  vtStore: VtDb;
  vtConfig: VtStageConfig;
  bands: BandConfig[];
};

export type BuildConfig<TTransformInput = TransformTaskInput, TVtInput = VtTaskInput> = {
  nodeId: NodeId;
  taskQueue: VtTaskQueueDb;
  transformHandler?: StageHandler<TTransformInput>;
  vtHandler?: StageHandler<TVtInput>;
  transformContext?: TransformStageContext;
  vtContext?: VtStageContext;
};

export type TaskRecord = TaskQueueRecord;
