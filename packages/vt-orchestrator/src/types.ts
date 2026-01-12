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

export type TransformByBandStageConfig = {
  toleranceK: number;
};

export type TransformByZoomStageConfig = {
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

export type TransformByBandTaskInput = {
  fetchCacheId: string;
  bandId: number;
  domainType: 'shape' | 'route';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  adminLevel?: number;
};

export type TransformByZoomTaskInput = {
  transformByBandCacheId: string;
  bandId: number;
};

export type VtTaskInput = {
  bandId: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  domainType: 'shape' | 'route';
  sourceKey: string;
};

export type TransformByBandStageContext = {
  shapeStore: VtShapeDb;
  transformConfig: TransformByBandStageConfig;
  bands: BandConfig[];
};

export type TransformByZoomStageContext = {
  shapeStore: VtShapeDb;
  zoomConfig: TransformByZoomStageConfig;
  bands: BandConfig[];
  maxBand3Reservations: number;
};

export type VtStageContext = {
  shapeStore: VtShapeDb;
  vtStore: VtDb;
  vtConfig: VtStageConfig;
  bands: BandConfig[];
};

export type BuildConfig<
  TTransformByBandInput = TransformByBandTaskInput,
  TTransformByZoomInput = TransformByZoomTaskInput,
  TVtInput = VtTaskInput
> = {
  nodeId: NodeId;
  taskQueue: VtTaskQueueDb;
  transformByBandHandler?: StageHandler<TTransformByBandInput>;
  transformByZoomHandler?: StageHandler<TTransformByZoomInput>;
  vtHandler?: StageHandler<TVtInput>;
  transformByBandContext?: TransformByBandStageContext;
  transformByZoomContext?: TransformByZoomStageContext;
  vtContext?: VtStageContext;
};

export type TaskRecord = TaskQueueRecord;
