import type { NodeId } from '@hierarchidb/core-types';
import type {
  StagedFolderActionBbox,
  StagedFolderMapImageCaptureAction,
} from './StagedFolderActionManifestTypes.js';

export type MapImageCaptureBrowserMode = 'headless' | 'headed';

export type MapImageCaptureLayerIntent = {
  path: string;
  visible: boolean;
};

export type MapImageCaptureIntent = {
  intentId: string;
  runId: NodeId;
  stagingRootNodeId: NodeId;
  browserMode: MapImageCaptureBrowserMode;
  mapRoute: {
    nodeId: NodeId;
    search: {
      captureIntentId: string;
    };
  };
  viewport: {
    bbox: StagedFolderActionBbox;
    width: number;
    height: number;
  };
  layers: MapImageCaptureLayerIntent[];
  output: {
    path: string;
  };
};

export type CreateMapImageCaptureIntentInput = {
  action: StagedFolderMapImageCaptureAction;
  actionIndex: number;
  runId: NodeId;
  stagingRootNodeId: NodeId;
  browserMode: MapImageCaptureBrowserMode;
};

export const createMapImageCaptureIntent = ({
  action,
  actionIndex,
  runId,
  stagingRootNodeId,
  browserMode,
}: CreateMapImageCaptureIntentInput): MapImageCaptureIntent => {
  assertPositiveInteger(action.output.width, 'action.output.width');
  assertPositiveInteger(action.output.height, 'action.output.height');
  assertNonNegativeInteger(actionIndex, 'actionIndex');
  const intentId = `${String(runId)}:${String(actionIndex)}`;
  return {
    intentId,
    runId,
    stagingRootNodeId,
    browserMode,
    mapRoute: {
      nodeId: stagingRootNodeId,
      search: {
        captureIntentId: intentId,
      },
    },
    viewport: {
      bbox: action.viewport.bbox,
      width: action.output.width,
      height: action.output.height,
    },
    layers: action.layers.map((layer) => ({
      path: layer.path,
      visible: layer.visible,
    })),
    output: {
      path: action.output.path,
    },
  };
};

const assertPositiveInteger = (value: number, field: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
};

const assertNonNegativeInteger = (value: number, field: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
};
