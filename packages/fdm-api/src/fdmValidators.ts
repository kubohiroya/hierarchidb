import type { NodeId } from '@hierarchidb/core-types';
import {
  FDM_NODE_DATA_VERSION,
  type FdmAxisDimension,
  type FdmAxisMap,
  FdmContractError,
  type FdmDialogData,
  type FdmFilters,
  type FdmNodeData,
  type FdmNodeIdentity,
  type FdmPromotionResult,
  type FdmViewMode,
} from './fdmTypes.js';

export const FDM_AXIS_DIMENSIONS: readonly FdmAxisDimension[] = [
  'profile',
  'dataset',
  'checkpoint',
  'compute',
] as const;

export const FDM_NODE_DATA_V1_DEFAULTS = {
  version: FDM_NODE_DATA_VERSION,
  viewMode: 'lattice-3d',
  filters: {
    profiles: [],
    datasets: [],
    computes: [],
    checkpoints: [],
  },
  axisMap: {
    xOuter: 'profile',
    xInner: 'dataset',
    y: 'checkpoint',
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
  if (existing !== undefined) {
    assertFdmNodeData(existing);
  }
  const data = {
    version: FDM_NODE_DATA_VERSION,
    connectionName: identity.connectionName,
    spaceId: identity.spaceId,
    ...(existing?.idegsmProjectNodeId === undefined
      ? {}
      : { idegsmProjectNodeId: existing.idegsmProjectNodeId }),
    ...(existing?.selectedStateDir === undefined
      ? {}
      : { selectedStateDir: existing.selectedStateDir }),
    viewMode: existing?.viewMode ?? FDM_NODE_DATA_V1_DEFAULTS.viewMode,
    filters: cloneFilters(existing?.filters ?? FDM_NODE_DATA_V1_DEFAULTS.filters),
    axisMap: { ...(existing?.axisMap ?? FDM_NODE_DATA_V1_DEFAULTS.axisMap) },
    tabularSnapshotRefs: [
      ...(existing?.tabularSnapshotRefs ?? FDM_NODE_DATA_V1_DEFAULTS.tabularSnapshotRefs),
    ],
  };
  assertFdmNodeData(data);
  return data;
}

export function createFdmNodeDataFromDraft(
  draft: FdmDialogData,
  existing?: FdmNodeData
): FdmNodeData {
  if (existing !== undefined) {
    assertFdmNodeData(existing);
  }
  const data = {
    version: FDM_NODE_DATA_VERSION,
    connectionName: draft.connectionName,
    spaceId: draft.spaceId,
    ...(draft.idegsmProjectNodeId === undefined
      ? existing?.idegsmProjectNodeId === undefined
        ? {}
        : { idegsmProjectNodeId: existing.idegsmProjectNodeId }
      : { idegsmProjectNodeId: draft.idegsmProjectNodeId }),
    ...(draft.selectedStateDir === undefined
      ? existing?.selectedStateDir === undefined
        ? {}
        : { selectedStateDir: existing.selectedStateDir }
      : { selectedStateDir: draft.selectedStateDir }),
    viewMode: draft.viewMode ?? existing?.viewMode ?? FDM_NODE_DATA_V1_DEFAULTS.viewMode,
    filters: cloneFilters(draft.filters ?? existing?.filters ?? FDM_NODE_DATA_V1_DEFAULTS.filters),
    axisMap: { ...(draft.axisMap ?? existing?.axisMap ?? FDM_NODE_DATA_V1_DEFAULTS.axisMap) },
    tabularSnapshotRefs: [
      ...(draft.tabularSnapshotRefs ??
        existing?.tabularSnapshotRefs ??
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
  assertStringArray(record.profiles, 'filters.profiles');
  assertStringArray(record.datasets, 'filters.datasets');
  assertStringArray(record.computes, 'filters.computes');
  assertStringArray(record.checkpoints, 'filters.checkpoints');
}

export function assertFdmAxisMap(value: unknown): asserts value is FdmAxisMap {
  const record = assertRecord(value, 'axisMap');
  const axes = [record.xOuter, record.xInner, record.y, record.z];
  for (const [index, axis] of axes.entries()) {
    if (typeof axis !== 'string' || !AXIS_DIMENSIONS.has(axis as FdmAxisDimension)) {
      throw new FdmContractError(`axisMap.${['xOuter', 'xInner', 'y', 'z'][index]} is invalid`);
    }
  }
  if (new Set(axes).size !== FDM_AXIS_DIMENSIONS.length) {
    throw new FdmContractError('axisMap must be an exact permutation');
  }
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

function cloneFilters(filters: FdmFilters): FdmFilters {
  return {
    profiles: [...filters.profiles],
    datasets: [...filters.datasets],
    computes: [...filters.computes],
    checkpoints: [...filters.checkpoints],
  };
}
