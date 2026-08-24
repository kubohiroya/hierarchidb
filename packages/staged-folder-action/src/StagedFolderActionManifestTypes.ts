export type StagedFolderActionManifestFormat = 'json' | 'yaml';

export type StagedFolderActionCliBrowserMode = 'headless' | 'headed';

export type StagedFolderActionStagingMode = 'temporary-copy' | 'permanent-copy' | 'patch-source';

export type StagedFolderActionCleanup = 'retain' | 'delete-on-success' | 'delete-always';

export type StagedFolderActionBbox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];

export type StagedFolderActionConfig = {
  version: 1;
  staging: {
    mode: StagedFolderActionStagingMode;
    name?: string;
    cleanup: StagedFolderActionCleanup;
  };
  overlay: {
    nodes: StagedFolderActionOverlayNode[];
  };
  actions: StagedFolderAction[];
};

export type StagedFolderActionOverlayNode = {
  match: {
    path: string;
  };
  data: Record<string, unknown>;
};

export type StagedFolderAction =
  | StagedFolderBuildAction
  | StagedFolderExportArchiveAction
  | StagedFolderImportMountAction
  | StagedFolderExportCsvAction
  | StagedFolderExportXlsxAction
  | StagedFolderMapImageCaptureAction;

export type StagedFolderActionType = StagedFolderAction['type'];

export type StagedFolderBuildAction = {
  type: 'build';
  mode: 'session-manager';
};

export type StagedFolderExportArchiveAction = {
  type: 'export-archive';
  format: 'canonical-yaml-zip';
  source: {
    path: string;
  };
  output: {
    path: string;
  };
};

export type StagedFolderImportMountAction = {
  type: 'import-mount';
  format: 'canonical-yaml-zip';
  input: {
    path: string;
  };
  mount: {
    parentPath: string;
    name: string;
    lifetime: 'run' | 'retain' | 'permanent';
  };
};

export type StagedFolderExportCsvAction = {
  type: 'export-csv';
  entityType: 'location' | 'route';
  source: {
    path: string;
  };
  output: {
    path: string;
  };
  columns?: string[];
  includeDependencyStatus?: boolean;
};

export type StagedFolderExportXlsxAction = {
  type: 'export-xlsx';
  entityType: 'location' | 'route';
  source: {
    path: string;
  };
  output: {
    path: string;
    sheetName?: string;
  };
  columns?: string[];
  includeDependencyStatus?: boolean;
};

export type StagedFolderMapImageCaptureAction = {
  type: 'map-image-capture';
  mode: 'map-ui';
  output: {
    path: string;
    width: number;
    height: number;
  };
  viewport: {
    bbox: StagedFolderActionBbox;
  };
  layers: Array<{
    path: string;
    visible: boolean;
  }>;
};

export type ParseStagedFolderActionManifestOptions = {
  format: StagedFolderActionManifestFormat;
};

export type ValidateStagedFolderActionCliOptionsInput = {
  config: StagedFolderActionConfig;
  sourceNodeId?: string;
  outputParentNodeId?: string;
  browserMode?: StagedFolderActionCliBrowserMode;
};

export type StagedFolderActionExecutionOwner =
  | 'runtime-worker'
  | 'existing-map-ui'
  | 'plugin-adapter';

export type StagedFolderActionRegistryEntry = {
  type: StagedFolderActionType;
  schema: string;
  prerequisite: string;
  executionOwner: StagedFolderActionExecutionOwner;
  resultSchema: string;
  artifactPolicy: string;
  errorCategory: string;
};
