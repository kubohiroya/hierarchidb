import type { NodeId } from '@hierarchidb/common-types';
import type { Extract1Task, Extract2Task } from '../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData, ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';
import type { FeatureCollection } from 'geojson';

import { buildExtract2TasksFromExtract1 } from './buildExtract2TasksFromExtract1.js';
import { buildExtract2TasksWithTopojsonFacade } from './buildExtract2TasksWithTopojsonFacade.js';

export type Extract2BuildStrategyParams = {
  nodeId: NodeId;

  // config-related
  zoomLevels: number[];
  extractionMode: 'topojson' | string;
  zoomRanges: Array<{ minZoom: number; maxZoom: number; zoomLevels: number[]; label: string }>;
  vectorTileBuffer: number;
  vectorTileExtent: number;
  scaleTolerance: (zoomMax: number) => number;
  tileExpandFactor?: number;
  tileExpandMargin?: number;

  // inputs
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;

  // shared helpers
  buildTaskId: (
    stage: 'extract2',
    details: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string; zoomRangeLabel?: string },
  ) => string;
  resolveTaskIdDetails: (
    task: { countryCode?: string; adminLevel?: number },
    input?: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string },
  ) => { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string; zoomRangeLabel?: string };
  getOriginKeyFromInput: (input?: { originKey?: string } | null) => string | undefined;

  // topojson specific
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
};

export type Extract2BuildStrategyResult = {
  tasks: Extract2Task[];
  inputsByTaskId: Map<string, ShapeExtract2TaskInputData>;
  shouldGroupByContinent: boolean;
};

export async function resolveExtract2BuildStrategy(
  params: Extract2BuildStrategyParams,
): Promise<Extract2BuildStrategyResult> {
  const { extractionMode } = params;
  const shouldGroupByContinent = extractionMode === 'topojson';

  const build = shouldGroupByContinent
    ? await buildExtract2TasksWithTopojsonFacade({
      nodeId: params.nodeId,
      extract1Tasks: params.extract1Tasks,
      extract1InputsByTaskId: params.extract1InputsByTaskId,
      zoomRanges: params.zoomRanges,
      vectorTileBuffer: params.vectorTileBuffer,
      vectorTileExtent: params.vectorTileExtent,
      scaleTolerance: params.scaleTolerance,
      tileExpandFactor: params.tileExpandFactor,
      tileExpandMargin: params.tileExpandMargin,
      buildTaskId: params.buildTaskId,
      resolveTaskContinent: params.resolveTaskContinent,
      resolveTaskCountryName: params.resolveTaskCountryName,
      resolveTaskCountryCode: params.resolveTaskCountryCode,
      resolveTaskAdminCode: params.resolveTaskAdminCode,
      getExtractedBuffer: params.getExtractedBuffer,
      decodeFeatureCollection: params.decodeFeatureCollection,
      encodeFeatureCollection: params.encodeFeatureCollection,
      putExtractedBuffers: params.putExtractedBuffers,
      consoleWarn: params.consoleWarn,
      consoleDebug: params.consoleDebug,
    })
    : buildExtract2TasksFromExtract1({
      nodeId: params.nodeId,
      extract1Tasks: params.extract1Tasks,
      extract1InputsByTaskId: params.extract1InputsByTaskId,
      zoomRanges: params.zoomRanges,
      vectorTileBuffer: params.vectorTileBuffer,
      vectorTileExtent: params.vectorTileExtent,
      scaleTolerance: params.scaleTolerance,
      buildTaskId: params.buildTaskId,
      getOriginKeyFromInput: params.getOriginKeyFromInput,
      resolveTaskIdDetails: params.resolveTaskIdDetails,
    });

  return {
    ...build,
    shouldGroupByContinent,
  };
}
