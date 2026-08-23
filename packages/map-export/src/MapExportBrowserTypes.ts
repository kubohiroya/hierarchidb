import type { MapExportJob } from './MapExportManifestTypes.js';

export const MAP_EXPORT_SCREENSHOT_TARGET_ATTRIBUTE = 'data-map-export-screenshot-target';
export const MAP_EXPORT_SCREENSHOT_SELECTOR = `[${MAP_EXPORT_SCREENSHOT_TARGET_ATTRIBUTE}="true"]`;

export type MapExportBrowserStatus = 'idle' | 'initializing' | 'ready' | 'failed';

export type MapExportBrowserErrorCode =
  | 'invalid_job'
  | 'job_already_running'
  | 'runtime_worker_unavailable'
  | 'node_commit_failed'
  | 'build_failed'
  | 'build_timeout'
  | 'maplibre_not_ready';

export type MapExportBrowserErrorSignal = {
  code: MapExportBrowserErrorCode;
  message: string;
  cause?: string;
};

export type MapExportBrowserTarget = {
  treeId: string;
  parentId: string;
};

export type MapExportBrowserJob = MapExportJob & {
  target: MapExportBrowserTarget;
};

export type MapExportBrowserCommittedNode = {
  manifestNodeId?: string;
  nodeId: string;
  nodeType: string;
};

export type MapExportBrowserState = {
  status: MapExportBrowserStatus;
  jobId?: string;
  nodes?: MapExportBrowserCommittedNode[];
  selector: typeof MAP_EXPORT_SCREENSHOT_SELECTOR;
  error?: MapExportBrowserErrorSignal;
};

export type MapExportBrowserSubmitResult = MapExportBrowserState;

export type MapExportBrowserApi = {
  getState: () => MapExportBrowserState;
  submitJob: (job: MapExportBrowserJob) => Promise<MapExportBrowserSubmitResult>;
};
