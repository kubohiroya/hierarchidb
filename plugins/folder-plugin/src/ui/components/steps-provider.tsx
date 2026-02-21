import { FolderExportFormatStep } from './folder-export/FolderExportFormatStep';
import { FolderExportOptionsStep } from './folder-export/FolderExportOptionsStep';
import { FolderExportPurposeStep } from './folder-export/FolderExportPurposeStep';
import { FolderExportReviewStep } from './folder-export/FolderExportReviewStep';
import { FolderExportTargetStep } from './folder-export/FolderExportTargetStep';
import { normalizeFolderExportDraft, type FolderExportDraftData } from './folder-export/types';
import { notify } from '@hierarchidb/components';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import {
  type PluginStepConfig,
  type PluginStepProps,
  type StartBuildContext,
  PluginStepRegistry,
} from '@hierarchidb/plugin-base';
import type { TreeNode } from '@hierarchidb/tree-api';

type FolderExportNode = Pick<TreeNode, 'id' | 'nodeType' | 'metadata'>;

type FolderExportWorkerQueryAPI = {
  getNode: (nodeId: NodeId) => Promise<FolderExportNode | undefined>;
  listDescendants: (nodeId: NodeId) => Promise<FolderExportNode[]>;
};

type FolderExportWorkerAPI = {
  exportNodes(params: {
    nodeIds: NodeId[];
    format: 'json' | 'pbf.zip' | 'mvf';
    includeChildren?: boolean;
    includeMetadata?: boolean;
  }): Promise<{
    data: string | Blob;
    format: string;
    filename: string;
    mimeType: string;
  }>;
};

type FolderExportRuntimeClient = {
  getQueryAPI: () => Promise<FolderExportWorkerQueryAPI>;
  getImportExportAPI: () => Promise<FolderExportWorkerAPI>;
};

type FolderExportWorkerRef = {
  client: FolderExportRuntimeClient | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  getAPI: () => FolderExportRuntimeClient;
};

type FolderExportWindowRef = {
  __HDB_WORKER_CLIENT_REF__?: FolderExportWorkerRef;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  var __HDB_WORKER_CLIENT_REF__: FolderExportWorkerRef | undefined;
}

type FolderExportStartContext = StartBuildContext<FolderExportDraftData>;

export const normalizeFolderExportFormat = (data: FolderExportDraftData): 'json' | 'pbf.zip' | 'mvf' => {
  const draft = normalizeFolderExportDraft(data);
  return draft.format;
};

export const resolveFolderExportNodes = async (
  queryAPI: FolderExportWorkerQueryAPI,
  rootNodeId: NodeId,
  targetScope: FolderExportDraftData['targetScope'],
): Promise<FolderExportNode[]> => {
  const root = await queryAPI.getNode(rootNodeId);
  if (!root) {
    return [];
  }

  if (targetScope === 'shapeOnly') {
    const descendants = await queryAPI.listDescendants(rootNodeId);
    return descendants.filter((node) => node.nodeType === 'shape');
  }

  const descendants = await queryAPI.listDescendants(rootNodeId);
  return [root, ...descendants];
};

export const createFolderExportFilename = (
  baseName: string,
  format: 'json' | 'pbf.zip' | 'mvf',
  timestamp = new Date(),
): string => {
  const safeBase = baseName.trim() || 'folder';
  const sanitized = safeBase.replace(/[\\/:*?"<>|]/g, '_').trim();
  const iso = timestamp.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const extension = format === 'pbf.zip' ? 'pbf.zip' : format === 'mvf' ? 'mvf' : 'json';
  return `${sanitized}-${iso}.${extension}`;
};

export const canStartFolderExport = (data?: FolderExportDraftData): boolean => {
  const normalized = normalizeFolderExportDraft(data);
  const hasValidScope = normalized.targetScope === 'all' || normalized.targetScope === 'shapeOnly';
  if (!hasValidScope) {
    return false;
  }

  if (normalized.exportMode === 'continuity') {
    return normalized.format === 'json';
  }

  return (
    (normalized.format === 'pbf.zip' || normalized.format === 'mvf') &&
    normalized.minZoom >= 0 &&
    normalized.maxZoom >= normalized.minZoom &&
    normalized.maxTileBytes > 0 &&
    Number.isFinite(normalized.minZoom) &&
    Number.isFinite(normalized.maxZoom) &&
    Number.isFinite(normalized.maxTileBytes)
  );
};

const getWorkerClient = (): FolderExportWorkerRef => {
  const win = globalThis as FolderExportWindowRef;
  const ref = win.__HDB_WORKER_CLIENT_REF__;
  if (!ref) {
    throw new Error('Worker client is not available.');
  }
  if (typeof ref.initialize !== 'function') {
    throw new Error('Worker client does not expose initialize().');
  }
  if (typeof ref.getAPI !== 'function') {
    throw new Error('Worker client does not expose getAPI().');
  }
  return ref;
};

const isJsonBlob = (value: string | Blob): value is Blob => value instanceof Blob;

const downloadExportResult = (data: string | Blob, filename: string, mimeType: string): void => {
  const blob = isJsonBlob(data) ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const startFolderExport = async (draft: FolderExportDraftData, context: FolderExportStartContext) => {
  const normalizedDraft = normalizeFolderExportDraft(draft);
  const targetNodeId = context.nodeId ?? context.parentId;
  if (!targetNodeId) {
    notify.error('Export target is not available.');
    return;
  }
  const nodeId = toNodeId(String(targetNodeId));

  try {
    const workerRef = getWorkerClient();
    if (!workerRef.isInitialized) {
      await workerRef.initialize();
    }
    const runtimeAPI = workerRef.client ?? workerRef.getAPI();
    const queryAPI = await runtimeAPI.getQueryAPI();
    const importExportAPI = await runtimeAPI.getImportExportAPI();

    const nodes = await resolveFolderExportNodes(queryAPI, nodeId, normalizedDraft.targetScope);
    const exportNodeIds = nodes.map((node) => node.id);

    if (!exportNodeIds.length) {
      notify.error('No node found for export.');
      return;
    }

    if (normalizedDraft.exportMode === 'distribution' && normalizedDraft.targetScope === 'all') {
      const hasShapeNode = nodes.some((node) => node.nodeType === 'shape');
      if (!hasShapeNode) {
        notify.error('Distribution mode requires at least one shape node in the selected scope.');
        return;
      }
    }

    const exportResult = await importExportAPI.exportNodes({
      nodeIds: exportNodeIds,
      format: normalizedDraft.format,
      includeMetadata: normalizedDraft.exportMode === 'continuity',
      includeChildren: false,
    });

    const targetNode = await queryAPI.getNode(nodeId);
    const baseName = targetNode?.metadata?.name || targetNodeId || 'folder-export';
    const filename = createFolderExportFilename(baseName, normalizeFolderExportFormat(normalizedDraft), new Date());
    downloadExportResult(exportResult.data, filename, exportResult.mimeType);
    notify.success(`Export started: ${filename}`);
  } catch (error) {
    notify.error(error instanceof Error ? error.message : 'Failed to export folder.');
  }
};

type FolderExportStepProps = PluginStepProps<FolderExportDraftData>;

const createFolderExportSteps = (): ReadonlyArray<PluginStepConfig<FolderExportDraftData>> => [
  {
    id: 'purpose',
    label: 'Export purpose',
    componentFactory: (props: FolderExportStepProps) => <FolderExportPurposeStep {...props} />,
    validate: (data) => Boolean(normalizeFolderExportDraft(data).exportMode),
  },
  {
    id: 'target',
    label: 'Target nodes',
    componentFactory: (props: FolderExportStepProps) => <FolderExportTargetStep {...props} />,
    validate: (data) => {
      const normalized = normalizeFolderExportDraft(data);
      return normalized.targetScope === 'all' || normalized.targetScope === 'shapeOnly';
    },
  },
  {
    id: 'format',
    label: 'Output format',
    componentFactory: (props: FolderExportStepProps) => <FolderExportFormatStep {...props} />,
    validate: (data) => {
      const normalized = normalizeFolderExportDraft(data);
      const isContinuity = normalized.exportMode === 'continuity';
      if (isContinuity) return normalized.format === 'json';
      return normalized.format === 'pbf.zip' || normalized.format === 'mvf';
    },
  },
  {
    id: 'options',
    label: 'Distribution options',
    componentFactory: (props: FolderExportStepProps) => <FolderExportOptionsStep {...props} />,
    validate: (data) => {
      const normalized = normalizeFolderExportDraft(data);
      if (normalized.exportMode === 'continuity') return true;
      return (
        normalized.minZoom >= 0 &&
        normalized.maxZoom >= normalized.minZoom &&
        normalized.maxTileBytes > 0 &&
        Number.isFinite(normalized.minZoom) &&
        Number.isFinite(normalized.maxZoom) &&
        Number.isFinite(normalized.maxTileBytes)
      );
    },
  },
  {
    id: 'review',
    label: 'Review',
    componentFactory: (props: FolderExportStepProps) => <FolderExportReviewStep {...props} />,
    validate: (data) => canStartFolderExport(data),
    capabilities: {
      canStartBuild: (data) => canStartFolderExport(data),
      canSave: () => false,
      startBuild: (data, context) => {
        return startFolderExport(data, context);
      },
    },
  },
];

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<FolderExportDraftData>({
  nodeType: 'folder-export',
  getCreateStepConfigs() {
    return createFolderExportSteps();
  },
  getEditStepConfigs(_nodeId?: string, _data?: FolderExportDraftData) {
    return this.getCreateStepConfigs();
  },
  validateAccess() {
    return Promise.resolve(true);
  },
});

registry.registerConfigProvider<FolderExportDraftData>({
  nodeType: 'folder',
  getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<FolderExportDraftData>> {
    return [];
  },
  getEditStepConfigs(_nodeId?: string, _data?: FolderExportDraftData) {
    return this.getCreateStepConfigs();
  },
  validateAccess() {
    return Promise.resolve(true);
  },
});
