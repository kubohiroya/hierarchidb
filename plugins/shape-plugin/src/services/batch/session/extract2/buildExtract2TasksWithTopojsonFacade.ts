import type { NodeId } from '@hierarchidb/common-types';
import type { Extract1Task, Extract2Task } from '../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData, ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';
import type { FeatureCollection } from 'geojson';

import { buildExtract2TasksWithTopoJSON as buildExtract2TasksWithTopoJSONInSession } from './topojsonGrouping.js';

export type Extract2TopojsonBuildFacadeResult = {
  tasks: Extract2Task[];
  inputsByTaskId: Map<string, ShapeExtract2TaskInputData>;
};

export async function buildExtract2TasksWithTopojsonFacade(params: {
  nodeId: NodeId;
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;
  zoomRanges: Array<{ minZoom: number; maxZoom: number; zoomLevels: number[]; label: string }>;
  vectorTileBuffer: number;
  vectorTileExtent: number;
  scaleTolerance: (zoomMax: number) => number;
  tileExpandFactor?: number;
  tileExpandMargin?: number;
  buildTaskId: (
    stage: 'extract2',
    details: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string; zoomRangeLabel?: string },
  ) => string;
  resolveTaskContinent: (input?: ShapeExtract1TaskInputData) => string | undefined;
  resolveTaskCountryName: (input?: ShapeExtract1TaskInputData) => string | undefined;
  resolveTaskCountryCode: (task: Extract1Task, input?: ShapeExtract1TaskInputData) => string | undefined;
  resolveTaskAdminCode: (input?: ShapeExtract1TaskInputData) => string | undefined;
  getExtractedBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  encodeFeatureCollection: (collection: FeatureCollection) => Promise<ArrayBuffer>;
  putExtractedBuffers: (buffers: Array<{ id: string; nodeId: NodeId; stage: 'extract1'; data: ArrayBuffer; featureCount: number; extractionRatio: number; tolerance: number; timestamp: number }>) => Promise<void>;
  consoleWarn?: (message: string, data?: unknown) => void;
  consoleDebug?: (message: string, data?: unknown) => void;
}): Promise<Extract2TopojsonBuildFacadeResult> {
  const {
    consoleWarn = () => {},
    consoleDebug = () => {},
    ...rest
  } = params;

  // topojsonGrouping は既存の session 実装を使う。ここは SessionController 依存の引数配線を集約する facade。
  const res = await buildExtract2TasksWithTopoJSONInSession({
    ...rest,
    consoleWarn,
    consoleDebug,
    buildTaskId: (_stage, details) => rest.buildTaskId('extract2', details),
  });

  return res;
}
