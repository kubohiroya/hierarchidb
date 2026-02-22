import type { NodeId, PeerEntity, TreeId } from '@hierarchidb/core-types';
import type { NodePayload, TreeNodeData } from '@hierarchidb/tree-api';
import type { Remote } from 'comlink';
import type { BuildWorkerAPI } from '~/types/worker-api';
import {
  buildShapePresetDraftDataPatch,
  getShapePresetMenuEntries,
  isShapeCreatePresetId,
  parseCreateAction as parseShapeCreateAction,
  resolveShapePresetNodeDefaults,
  type ShapeCreatePresetId,
  type TranslateWithFallback,
} from '~/features/shape/shapeCreatePresets';

export type TemplateTreeContext = 'resources' | 'projects';

export interface NodeCreateTemplateMenuEntry {
  key: string;
  nodeType: string;
  createType: string;
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
}

type FolderTemplateDefinition = {
  id: 'population-2023';
  nodeType: 'folder';
  contexts: readonly TemplateTreeContext[];
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  templateFiles: readonly string[];
};

const CREATE_ACTION_PREFIX = 'create:';
const GENERIC_TEMPLATE_MARKER = '::template:';
const DEFAULT_TEMPLATE_ID = 'default';

const FOLDER_TEMPLATE_DEFINITIONS: readonly FolderTemplateDefinition[] = [
  {
    id: 'population-2023',
    nodeType: 'folder',
    contexts: ['resources'],
    labelKey: 'treeConsole.nodeTemplates.folder.populationByCountries.name',
    labelFallback: 'Population by Countries',
    descriptionKey: 'treeConsole.nodeTemplates.folder.populationByCountries.description',
    descriptionFallback:
      'Create a population-by-country folder template with preconfigured child nodes.',
    templateFiles: ['population-by-countries-2023.json'],
  },
] as const;

const FOLDER_TEMPLATE_MAP = new Map<string, FolderTemplateDefinition>(
  FOLDER_TEMPLATE_DEFINITIONS.map((definition) => [definition.id, definition])
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeRecord = (value: unknown): Record<string, unknown> | null | undefined => {
  if (value === null) return null;
  if (isRecord(value)) return value;
  return undefined;
};

const isPeerEntityPayload = (value: Record<string, unknown>): value is PeerEntity<NodePayload> =>
  typeof value.id === 'string' &&
  typeof value.createdAt === 'number' &&
  typeof value.updatedAt === 'number' &&
  typeof value.version === 'number';

type TemplateNodeInput = {
  version?: unknown;
  metadata?: unknown;
  nodeType?: unknown;
  treeNodeType?: unknown;
  draftMetadata?: unknown;
  draftData?: unknown;
  data?: unknown;
  children?: unknown;
};

type TemplateData = {
  nodes?: TemplateNodeInput[];
  rootNodeIds?: string[];
};

export type ParsedNodeCreateAction = {
  nodeType: string;
  shapePresetId?: ShapeCreatePresetId;
  templateId?: string;
};

export type ResolvedNodeTemplateExecution =
  | { kind: 'shapePreset'; presetId: ShapeCreatePresetId }
  | { kind: 'importTemplate'; templateId: string };

export type ResolvedNodeCreateDefaults = {
  name?: string;
  description?: string;
  draftPatch?: Partial<TreeNodeData>;
};

const toNodeType = (value: string): string => value;

function computeTemplateBasePath(): string {
  const envBase = import.meta.env.BASE_URL || '';
  if (envBase.length > 0) return envBase;

  if (typeof document !== 'undefined' && document.baseURI) {
    try {
      return new URL(document.baseURI).pathname || '/';
    } catch {
      return '/';
    }
  }

  return '/';
}

async function tryFetchTemplateData(url: string): Promise<TemplateData> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!/json/i.test(contentType)) {
    const text = await response.text();
    if (text.trim().startsWith('<')) {
      throw new Error('NOT_JSON');
    }
    try {
      return JSON.parse(text) as TemplateData;
    } catch {
      throw new Error('INVALID_JSON');
    }
  }

  return (await response.json()) as TemplateData;
}

function toImportNode(node: TemplateNodeInput): {
  name: string;
  nodeType: string;
  description?: string;
  metadata: Record<string, unknown>;
  version?: number;
  draftMetadata?: Record<string, unknown> | null;
  draftData?: Record<string, unknown>;
  data?: PeerEntity<NodePayload>;
  children?: ReturnType<typeof toImportNode>[];
} {
  if (!isRecord(node)) {
    throw new Error('Invalid template node');
  }

  const rawMetadata = node.metadata;
  if (!isRecord(rawMetadata)) {
    throw new Error('Template node missing metadata');
  }

  if (typeof rawMetadata.name !== 'string' || rawMetadata.name.trim().length === 0) {
    throw new Error('Template node missing metadata.name');
  }

  const name = rawMetadata.name;
  const description =
    typeof rawMetadata.description === 'string' ? rawMetadata.description : undefined;
  const children = Array.isArray(node.children)
    ? node.children.map((child) => toImportNode(child as TemplateNodeInput))
    : undefined;
  const version = typeof node.version === 'number' ? node.version : 1;

  const resolvedNodeType =
    typeof node.nodeType === 'string'
      ? toNodeType(node.nodeType)
      : typeof node.treeNodeType === 'string'
        ? toNodeType(node.treeNodeType)
        : 'folder';

  const normalizedData = normalizeRecord(node.data);
  const data =
    normalizedData && isPeerEntityPayload(normalizedData) ? normalizedData : undefined;
  const normalizedDraftMetadata = normalizeRecord(node.draftMetadata);
  const rawBuildMetadata = rawMetadata.buildMetadata;
  const draftBuildMetadata = normalizedDraftMetadata?.buildMetadata;
  const hasBuildMetadata = rawBuildMetadata != null || draftBuildMetadata != null;
  const rawBuildMetadataObject =
    typeof rawBuildMetadata === 'object' && rawBuildMetadata !== null
      ? rawBuildMetadata
      : undefined;
  const draftBuildMetadataObject =
    typeof draftBuildMetadata === 'object' && draftBuildMetadata !== null
      ? draftBuildMetadata
      : undefined;
  const requiresBuildMetadataDefault = resolvedNodeType === 'shape' || resolvedNodeType === 'styler';
  const importedMetadata = {
    ...rawMetadata,
    ...(requiresBuildMetadataDefault && !hasBuildMetadata
      ? { buildMetadata: { buildRequired: true } }
      : rawBuildMetadataObject
      ? { buildMetadata: rawBuildMetadataObject }
      : {}),
  };
  const importedDraftMetadata =
    requiresBuildMetadataDefault && !hasBuildMetadata
      ? { ...(normalizedDraftMetadata ?? {}), buildMetadata: { buildRequired: true } }
      : draftBuildMetadataObject
      ? { ...(normalizedDraftMetadata ?? {}), buildMetadata: draftBuildMetadataObject }
      : normalizedDraftMetadata;

  return {
    name,
    version,
    nodeType: resolvedNodeType,
    description,
    metadata: importedMetadata,
    draftMetadata: importedDraftMetadata,
    draftData: normalizeRecord(node.draftData) ?? undefined,
    data,
    children: children && children.length > 0 ? children : undefined,
  };
}

function buildTemplateCreateType(nodeType: string, templateId: string): string {
  return `${nodeType}${GENERIC_TEMPLATE_MARKER}${templateId}`;
}

export function parseNodeCreateAction(action: string): ParsedNodeCreateAction | null {
  const parsedShape = parseShapeCreateAction(action);
  if (parsedShape?.shapePresetId) {
    return parsedShape;
  }

  if (!action.startsWith(CREATE_ACTION_PREFIX)) return null;

  const createType = action.slice(CREATE_ACTION_PREFIX.length).trim();
  if (!createType) return null;

  const [nodeTypeRaw, templateRaw] = createType.split(GENERIC_TEMPLATE_MARKER);
  const nodeType = nodeTypeRaw?.trim().toLowerCase();
  if (!nodeType) return null;

  if (!templateRaw) {
    return { nodeType };
  }

  const templateId = templateRaw.trim();
  if (!templateId) return null;
  if (templateId === DEFAULT_TEMPLATE_ID) {
    return { nodeType };
  }

  return { nodeType, templateId };
}

export function resolveNodeTemplateExecution(
  nodeType: string,
  templateId: string
): ResolvedNodeTemplateExecution | null {
  if (nodeType === 'shape' && isShapeCreatePresetId(templateId)) {
    return {
      kind: 'shapePreset',
      presetId: templateId,
    };
  }

  if (nodeType === 'folder' && FOLDER_TEMPLATE_MAP.has(templateId)) {
    return {
      kind: 'importTemplate',
      templateId,
    };
  }

  return null;
}

export function resolveNodeCreateDefaults(
  execution: ResolvedNodeTemplateExecution,
  translateWithFallback: TranslateWithFallback
): ResolvedNodeCreateDefaults {
  if (execution.kind === 'shapePreset') {
    const defaults = resolveShapePresetNodeDefaults(execution.presetId, translateWithFallback);
    const draftPatch = buildShapePresetDraftDataPatch(execution.presetId);
    return {
      name: defaults.name,
      description: defaults.description,
      draftPatch,
    };
  }

  return {};
}

export function getNodeCreateTemplateMenuEntries(
  nodeType: string,
  context: TemplateTreeContext
): readonly NodeCreateTemplateMenuEntry[] {
  if (nodeType === 'shape') {
    return getShapePresetMenuEntries();
  }

  if (nodeType === 'folder') {
    const defaultEntry: NodeCreateTemplateMenuEntry = {
      key: 'folder-template-default',
      nodeType: 'folder',
      createType: buildTemplateCreateType('folder', DEFAULT_TEMPLATE_ID),
      labelKey: 'treeConsole.nodeTemplates.folder.default.name',
      label: 'Default',
      descriptionKey: 'treeConsole.nodeTemplates.folder.default.description',
      description: 'Create an empty folder with no child nodes.',
    };

    return [
      defaultEntry,
      ...FOLDER_TEMPLATE_DEFINITIONS.filter((definition) =>
        definition.contexts.includes(context)
      ).map((definition) => ({
        key: `folder-template-${definition.id}`,
        nodeType: definition.nodeType,
        createType: buildTemplateCreateType(definition.nodeType, definition.id),
        labelKey: definition.labelKey,
        label: definition.labelFallback,
        descriptionKey: definition.descriptionKey,
        description: definition.descriptionFallback,
      })),
    ];
  }

  return [];
}

export function getFolderImportTemplateOptions(
  context: TemplateTreeContext
): Array<{ id: string; labelKey: string; label: string }> {
  return FOLDER_TEMPLATE_DEFINITIONS.filter((definition) =>
    definition.contexts.includes(context)
  ).map((definition) => ({
    id: definition.id,
    labelKey: definition.labelKey,
    label: definition.labelFallback,
  }));
}

export async function importNodeTemplateById(params: {
  client: Remote<BuildWorkerAPI>;
  treeId: TreeId;
  targetParentId: NodeId;
  templateId: string;
}): Promise<void> {
  const definition = FOLDER_TEMPLATE_MAP.get(params.templateId);
  if (!definition) {
    throw new Error(`Unknown template: ${params.templateId}`);
  }

  const base = computeTemplateBasePath().replace(/\/+$/, '/');
  const candidateBases = Array.from(new Set([base, '/hierarchidb/', '/']));

  let templateData: TemplateData | undefined;
  let lastError: unknown;

  for (const candidateBase of candidateBases) {
    for (const filename of definition.templateFiles) {
      const url = `${String(candidateBase).replace(/\/+$/, '/')}templates/${definition.id}/${filename}`;
      try {
        templateData = await tryFetchTemplateData(url);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (templateData) break;
  }

  if (!templateData) {
    throw new Error(`Failed to load template: ${definition.id} (${String(lastError)})`);
  }

  if (!Array.isArray(templateData.nodes)) {
    throw new Error('Template nodes must be an array with nested children.');
  }

  const importNodes = templateData.nodes.map((node) => toImportNode(node));
  const importExportAPI = await params.client.getImportExportAPI();

  await importExportAPI.importNodes({
    treeId: params.treeId,
    targetParentId: params.targetParentId,
    data: { nodes: importNodes },
    format: 'json',
    conflictResolution: 'rename',
  });
}
