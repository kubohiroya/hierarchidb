import type { NodeId } from '@hierarchidb/core-types';
import {
  FDM_NODE_DATA_VERSION,
  type FdmAxisDimension,
  type FdmAxisMap,
  type FdmCanonicalAxisDimension,
  FdmContractError,
  type FdmDialogData,
  type FdmFilters,
  type FdmLegacyAxisDimension,
  type FdmNodeData,
  type FdmNodeIdentity,
  type FdmPromotionResult,
  type FdmSpaceCatalog,
  type FdmSpaceCatalogEntry,
  type FdmViewMode,
} from './fdmTypes.js';

export const FDM_AXIS_DIMENSIONS: readonly FdmAxisDimension[] = [
  'parameterSet',
  'profile',
  'dataset',
  'timeline',
  'checkpoint',
  'compute',
] as const;

export const FDM_CANONICAL_AXIS_DIMENSIONS: readonly FdmCanonicalAxisDimension[] = [
  'parameterSet',
  'dataset',
  'timeline',
  'compute',
] as const;

export const FDM_LEGACY_AXIS_DIMENSIONS: readonly FdmLegacyAxisDimension[] = [
  'profile',
  'checkpoint',
] as const;

export const FDM_NODE_DATA_V1_DEFAULTS = {
  version: FDM_NODE_DATA_VERSION,
  viewMode: 'lattice-3d',
  filters: {
    parameterSets: [],
    datasets: [],
    computes: [],
    timelines: [],
  },
  axisMap: {
    xOuter: 'parameterSet',
    xInner: 'dataset',
    y: 'timeline',
    z: 'compute',
  },
  tabularSnapshotRefs: [],
} as const satisfies Pick<
  FdmNodeData,
  'version' | 'viewMode' | 'filters' | 'axisMap' | 'tabularSnapshotRefs'
>;

const VIEW_MODES = new Set<FdmViewMode>(['lattice-3d', 'matrix-2d', 'map']);
const AXIS_DIMENSIONS = new Set<FdmAxisDimension>(FDM_AXIS_DIMENSIONS);
const FORBIDDEN_NODE_DATA_KEYS = [
  'endpoint',
  'endpointUrl',
  'graphqlUrl',
  'webSocketUrl',
  'token',
  'jwt',
  'authToken',
  'credential',
  'credentials',
  'password',
  'rawBody',
  'body',
  'dashboard',
  'dashboardState',
  'tabularRows',
  'csvText',
  'absolutePath',
] as const;

export function createFdmNodeData(identity: FdmNodeIdentity, existing?: FdmNodeData): FdmNodeData {
  assertNonEmptyString(identity.connectionName, 'connectionName');
  assertNonEmptyString(identity.spaceId, 'spaceId');
  const normalizedExisting = existing === undefined ? undefined : normalizeFdmNodeData(existing);
  if (existing !== undefined) {
    assertFdmNodeData(normalizedExisting);
  }
  const data = {
    version: FDM_NODE_DATA_VERSION,
    connectionName: identity.connectionName,
    spaceId: identity.spaceId,
    ...(normalizedExisting?.idegsmProjectNodeId === undefined
      ? {}
      : { idegsmProjectNodeId: normalizedExisting.idegsmProjectNodeId }),
    ...(normalizedExisting?.selectedStateDir === undefined
      ? {}
      : { selectedStateDir: normalizedExisting.selectedStateDir }),
    viewMode: normalizedExisting?.viewMode ?? FDM_NODE_DATA_V1_DEFAULTS.viewMode,
    filters: cloneFilters(normalizedExisting?.filters ?? FDM_NODE_DATA_V1_DEFAULTS.filters),
    axisMap: { ...(normalizedExisting?.axisMap ?? FDM_NODE_DATA_V1_DEFAULTS.axisMap) },
    tabularSnapshotRefs: [
      ...(normalizedExisting?.tabularSnapshotRefs ?? FDM_NODE_DATA_V1_DEFAULTS.tabularSnapshotRefs),
    ],
  };
  assertFdmNodeData(data);
  return data;
}

export function createFdmNodeDataFromDraft(
  draft: FdmDialogData,
  existing?: FdmNodeData
): FdmNodeData {
  const normalizedExisting = existing === undefined ? undefined : normalizeFdmNodeData(existing);
  if (existing !== undefined) {
    assertFdmNodeData(normalizedExisting);
  }
  const normalizedDraft = normalizeFdmDialogData(draft);
  const data = {
    version: FDM_NODE_DATA_VERSION,
    connectionName: normalizedDraft.connectionName,
    spaceId: normalizedDraft.spaceId,
    ...(normalizedDraft.idegsmProjectNodeId === undefined
      ? normalizedExisting?.idegsmProjectNodeId === undefined
        ? {}
        : { idegsmProjectNodeId: normalizedExisting.idegsmProjectNodeId }
      : { idegsmProjectNodeId: normalizedDraft.idegsmProjectNodeId }),
    ...(normalizedDraft.selectedStateDir === undefined
      ? normalizedExisting?.selectedStateDir === undefined
        ? {}
        : { selectedStateDir: normalizedExisting.selectedStateDir }
      : { selectedStateDir: normalizedDraft.selectedStateDir }),
    viewMode:
      normalizedDraft.viewMode ??
      normalizedExisting?.viewMode ??
      FDM_NODE_DATA_V1_DEFAULTS.viewMode,
    filters: cloneFilters(
      normalizedDraft.filters ?? normalizedExisting?.filters ?? FDM_NODE_DATA_V1_DEFAULTS.filters
    ),
    axisMap: {
      ...(normalizedDraft.axisMap ??
        normalizedExisting?.axisMap ??
        FDM_NODE_DATA_V1_DEFAULTS.axisMap),
    },
    tabularSnapshotRefs: [
      ...(normalizedDraft.tabularSnapshotRefs ??
        normalizedExisting?.tabularSnapshotRefs ??
        FDM_NODE_DATA_V1_DEFAULTS.tabularSnapshotRefs),
    ],
  };
  assertFdmNodeData(data);
  return data;
}

export function assertFdmNodeData(value: unknown): asserts value is FdmNodeData {
  const record = assertRecord(value, 'FDM node data');
  rejectForbiddenKeys(record, FORBIDDEN_NODE_DATA_KEYS, 'FDM node data');
  if (record.version !== FDM_NODE_DATA_VERSION) {
    throw new FdmContractError('FDM node data version must be 1');
  }
  assertNonEmptyString(record.connectionName, 'connectionName');
  assertNonEmptyString(record.spaceId, 'spaceId');
  assertOptionalNodeId(record.idegsmProjectNodeId, 'idegsmProjectNodeId');
  assertOptionalTrimmedString(record.selectedStateDir, 'selectedStateDir');
  assertViewMode(record.viewMode);
  assertFdmFilters(record.filters);
  assertFdmAxisMap(record.axisMap);
  assertStringArray(record.tabularSnapshotRefs, 'tabularSnapshotRefs');
}

export function normalizeFdmNodeData(value: FdmNodeData): FdmNodeData {
  assertFdmNodeDataShape(value);
  const normalized = {
    ...value,
    filters: normalizeFdmFilters(value.filters),
    axisMap: normalizeFdmAxisMap(value.axisMap),
  };
  assertFdmNodeData(normalized);
  return normalized;
}

function normalizeFdmDialogData(value: FdmDialogData): FdmDialogData {
  return {
    ...value,
    ...(value.filters === undefined ? {} : { filters: normalizeFdmFilters(value.filters) }),
    ...(value.axisMap === undefined ? {} : { axisMap: normalizeFdmAxisMap(value.axisMap) }),
  };
}

function assertFdmNodeDataShape(value: unknown): asserts value is FdmNodeData {
  const record = assertRecord(value, 'FDM node data');
  rejectForbiddenKeys(record, FORBIDDEN_NODE_DATA_KEYS, 'FDM node data');
  if (record.version !== FDM_NODE_DATA_VERSION) {
    throw new FdmContractError('FDM node data version must be 1');
  }
  assertNonEmptyString(record.connectionName, 'connectionName');
  assertNonEmptyString(record.spaceId, 'spaceId');
  assertOptionalNodeId(record.idegsmProjectNodeId, 'idegsmProjectNodeId');
  assertOptionalTrimmedString(record.selectedStateDir, 'selectedStateDir');
  assertViewMode(record.viewMode);
  assertFdmFilters(record.filters);
  assertFdmAxisMap(record.axisMap);
  assertStringArray(record.tabularSnapshotRefs, 'tabularSnapshotRefs');
}

export function assertFdmPromotionResult(value: unknown): asserts value is FdmPromotionResult {
  const record = assertRecord(value, 'FDM promotion result');
  if (record.nodeId !== undefined) {
    assertNonEmptyString(record.nodeId, 'nodeId');
  }
  const nodeVersion = record.nodeVersion;
  if (
    nodeVersion !== undefined &&
    (typeof nodeVersion !== 'number' || !Number.isInteger(nodeVersion) || nodeVersion < 0)
  ) {
    throw new FdmContractError('nodeVersion must be a non-negative integer');
  }
  assertFdmNodeData(record.data);
}

export function assertFdmFilters(value: unknown): asserts value is FdmFilters {
  const record = assertRecord(value, 'filters');
  assertStringArray(record.parameterSets ?? record.profiles, 'filters.parameterSets');
  assertStringArray(record.datasets, 'filters.datasets');
  assertStringArray(record.computes, 'filters.computes');
  assertStringArray(record.timelines ?? record.checkpoints, 'filters.timelines');
  assertOptionalStringArray(record.profiles, 'filters.profiles');
  assertOptionalStringArray(record.checkpoints, 'filters.checkpoints');
  assertOptionalStringArray(record.rangeProfiles, 'filters.rangeProfiles');
}

export function assertFdmAxisMap(value: unknown): asserts value is FdmAxisMap {
  const record = assertRecord(value, 'axisMap');
  const axes = [record.xOuter, record.xInner, record.y, record.z];
  for (const [index, axis] of axes.entries()) {
    if (typeof axis !== 'string' || !AXIS_DIMENSIONS.has(axis as FdmAxisDimension)) {
      throw new FdmContractError(`axisMap.${['xOuter', 'xInner', 'y', 'z'][index]} is invalid`);
    }
  }
  if (new Set(axes).size !== axes.length) {
    throw new FdmContractError('axisMap must not contain duplicate dimensions');
  }
}

export function createFdmSpaceCatalogEntries(
  catalog: FdmSpaceCatalog
): readonly FdmSpaceCatalogEntry[] {
  assertNonEmptyString(catalog.defaultSpaceId, 'defaultSpaceId');
  const capabilitySummary = summarizeFdmCapabilities(catalog.capabilities);
  return catalog.spaces.map((space) => {
    assertNonEmptyString(space.spaceId, 'spaceId');
    const hasUnscopedProvenance =
      capabilitySummary.baselineCount > 0 ||
      capabilitySummary.forkCount > 0 ||
      capabilitySummary.lineageCount > 0;
    return {
      spaceId: space.spaceId,
      ...(space.label === null || space.label === undefined ? {} : { label: space.label }),
      kind: space.archived === true ? 'archived' : 'unknown',
      catalog: {
        ...(space.defaultSpace === null || space.defaultSpace === undefined
          ? {}
          : { defaultSpace: space.defaultSpace }),
        ...(space.visible === null || space.visible === undefined
          ? {}
          : { visible: space.visible }),
        ...(space.archived === null || space.archived === undefined
          ? {}
          : { archived: space.archived }),
        ...(space.owner === null || space.owner === undefined ? {} : { owner: space.owner }),
        ...(space.layoutVersion === null || space.layoutVersion === undefined
          ? {}
          : { layoutVersion: space.layoutVersion }),
        ...(space.legacyRoot === null || space.legacyRoot === undefined
          ? {}
          : { legacyRoot: space.legacyRoot }),
        ...(space.order === null || space.order === undefined ? {} : { order: space.order }),
        ...(space.createdAt === null || space.createdAt === undefined
          ? {}
          : { createdAt: space.createdAt }),
        ...(space.defaults === null || space.defaults === undefined
          ? {}
          : { defaults: space.defaults }),
        ...(space.warnings === null || space.warnings === undefined
          ? {}
          : { warnings: space.warnings }),
      },
      capability: {
        canRead: true,
        source: 'server',
        ...(capabilitySummary.serverCapabilities.length === 0
          ? {}
          : { serverCapabilities: capabilitySummary.serverCapabilities }),
        ...(capabilitySummary.baselineCount === 0
          ? {}
          : { baselineCount: capabilitySummary.baselineCount }),
        ...(capabilitySummary.forkCount === 0 ? {} : { forkCount: capabilitySummary.forkCount }),
        ...(capabilitySummary.lineageCount === 0
          ? {}
          : { lineageCount: capabilitySummary.lineageCount }),
      },
      provenance: {
        status: 'unavailable',
        spaceId: space.spaceId,
        ...(hasUnscopedProvenance ? { source: 'fdmCapabilities' } : {}),
        reason: hasUnscopedProvenance
          ? 'FDM_SPACE_PROVENANCE_UNSCOPED'
          : 'FDM_SPACE_PROVENANCE_UNAVAILABLE',
      },
    } satisfies FdmSpaceCatalogEntry;
  });
}

function summarizeFdmCapabilities(capabilities: FdmSpaceCatalog['capabilities']) {
  const supportedCapabilities = capabilities?.capabilities?.filter((capability) => {
    return capability.supported && capability.name !== null;
  });
  const serverCapabilities =
    supportedCapabilities?.map((capability) => capability.name ?? '') ?? [];
  const baselineCount = capabilities?.baselines?.length ?? 0;
  const forkCount = capabilities?.forks?.length ?? 0;
  const lineageCount = capabilities?.lineage?.length ?? 0;
  return {
    serverCapabilities,
    baselineCount,
    forkCount,
    lineageCount,
  };
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FdmContractError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function rejectForbiddenKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string
): void {
  for (const key of keys) {
    if (Object.hasOwn(record, key)) {
      throw new FdmContractError(`${label} must not contain ${key}`);
    }
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new FdmContractError(`${fieldName} must be a trimmed non-empty string`);
  }
}

function assertOptionalTrimmedString(
  value: unknown,
  fieldName: string
): asserts value is string | undefined {
  if (value === undefined) return;
  assertNonEmptyString(value, fieldName);
}

function assertOptionalNodeId(
  value: unknown,
  fieldName: string
): asserts value is NodeId | undefined {
  if (value === undefined) return;
  assertNonEmptyString(value, fieldName);
}

function assertViewMode(value: unknown): asserts value is FdmViewMode {
  if (typeof value !== 'string' || !VIEW_MODES.has(value as FdmViewMode)) {
    throw new FdmContractError('viewMode is invalid');
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is readonly string[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError(`${fieldName} must be an array`);
  }
  for (const entry of value) {
    assertNonEmptyString(entry, fieldName);
  }
}

function assertOptionalStringArray(
  value: unknown,
  fieldName: string
): asserts value is readonly string[] | undefined {
  if (value === undefined) return;
  assertStringArray(value, fieldName);
}

function cloneFilters(filters: FdmFilters): FdmFilters {
  return normalizeFdmFilters(filters);
}

function normalizeFdmFilters(filters: FdmFilters): FdmFilters {
  return {
    parameterSets: [...(filters.parameterSets ?? filters.profiles ?? [])],
    datasets: [...filters.datasets],
    computes: [...filters.computes],
    timelines: [...(filters.timelines ?? filters.checkpoints ?? [])],
    ...(filters.rangeProfiles === undefined ? {} : { rangeProfiles: [...filters.rangeProfiles] }),
  };
}

function normalizeFdmAxisMap(axisMap: FdmAxisMap): FdmAxisMap {
  return {
    xOuter: normalizeFdmAxisDimension(axisMap.xOuter),
    xInner: normalizeFdmAxisDimension(axisMap.xInner),
    y: normalizeFdmAxisDimension(axisMap.y),
    z: normalizeFdmAxisDimension(axisMap.z),
  };
}

function normalizeFdmAxisDimension(axis: FdmAxisDimension): FdmAxisDimension {
  if (axis === 'profile') return 'parameterSet';
  if (axis === 'checkpoint') return 'timeline';
  return axis;
}
