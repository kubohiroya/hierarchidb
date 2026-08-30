import {
  FDM_AXIS_TO_COLLECTION,
  FDM_CELL_STATUSES,
  type FdmDashboardCell,
  type FdmDashboardConnectionState,
  type FdmDashboardDimensions,
  type FdmDashboardResponse,
  type FdmDimensionValue,
  type FdmDirectoryEntry,
  type FdmResultLocation,
  type FdmRuntimeEvent,
} from './fdmDashboardTypes.js';
import { FdmContractError } from './fdmTypes.js';
import { assertFdmFilters, assertFdmNodeData } from './fdmValidators.js';

const CONNECTION_STATES = new Set<FdmDashboardConnectionState>([
  'connected',
  'reconnecting',
  'disconnected',
  'stale',
]);
const CELL_STATUSES = new Set<string>(FDM_CELL_STATUSES);
const DIRECTORY_KINDS = new Set(['directory', 'file', 'result']);
const FORBIDDEN_DASHBOARD_KEYS = [
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
  'absolutePath',
  'serverPath',
  'rawPath',
  'csvText',
  'tabularRows',
] as const;

export function assertFdmDashboardResponse(value: unknown): asserts value is FdmDashboardResponse {
  const record = assertRecord(value, 'FDM dashboard response');
  rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'FDM dashboard response');
  assertFdmNodeData(record.node);
  assertConnectionState(record.connectionState);
  assertNonEmptyString(record.spaceLabel, 'spaceLabel');
  assertStringArray(record.stateDirectories, 'stateDirectories');
  if (record.selectedStateDir !== undefined) {
    assertNonEmptyString(record.selectedStateDir, 'selectedStateDir');
  }
  assertDimensions(record.dimensions);
  assertCellArray(record.cells, record.dimensions);
  assertRuntimeEvents(record.runtimeEvents);
  assertStringArray(record.logs, 'logs');
  assertDirectoryEntries(record.directoryEntries);
  assertResultLocations(record.resultLocations);
  assertNonEmptyString(record.refreshedAt, 'refreshedAt');
}

export function summarizeFdmCells(cells: readonly FdmDashboardCell[]) {
  const summary = {
    totalCells: cells.length,
    succeeded: 0,
    running: 0,
    failed: 0,
    blocked: 0,
  };
  for (const cell of cells) {
    if (cell.status === 'succeeded') summary.succeeded += 1;
    if (cell.status === 'running') summary.running += 1;
    if (cell.status === 'failed') summary.failed += 1;
    if (cell.status === 'blocked') summary.blocked += 1;
  }
  return summary;
}

export function filterFdmCells(cells: readonly FdmDashboardCell[], filters: unknown) {
  assertFdmFilters(filters);
  return cells.filter((cell) => {
    return (
      matchesFilter(filters.profiles, cell.profile) &&
      matchesFilter(filters.datasets, cell.dataset) &&
      matchesFilter(filters.computes, cell.compute) &&
      matchesFilter(filters.checkpoints, cell.checkpoint)
    );
  });
}

export function projectFdmCellAxisKey(cell: FdmDashboardCell, axis: unknown): string {
  assertAxisDimension(axis);
  if (axis === 'profile') return cell.profile;
  if (axis === 'dataset') return cell.dataset;
  if (axis === 'checkpoint') return cell.checkpoint;
  return cell.compute;
}

function assertDimensions(value: unknown): asserts value is FdmDashboardDimensions {
  const record = assertRecord(value, 'dimensions');
  for (const collection of Object.values(FDM_AXIS_TO_COLLECTION)) {
    assertDimensionValueArray(record[collection], `dimensions.${collection}`);
  }
}

function assertDimensionValueArray(
  value: unknown,
  fieldName: string
): asserts value is readonly FdmDimensionValue[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError(`${fieldName} must be an array`);
  }
  const ids = new Set<string>();
  for (const entry of value) {
    const record = assertRecord(entry, fieldName);
    assertNonEmptyString(record.id, `${fieldName}.id`);
    assertNonEmptyString(record.label, `${fieldName}.label`);
    if (ids.has(record.id)) {
      throw new FdmContractError(`${fieldName} contains duplicated id`);
    }
    ids.add(record.id);
  }
}

function assertCellArray(
  value: unknown,
  dimensions: FdmDashboardDimensions
): asserts value is readonly FdmDashboardCell[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('cells must be an array');
  }
  const profiles = idsOf(dimensions.profiles);
  const datasets = idsOf(dimensions.datasets);
  const computes = idsOf(dimensions.computes);
  const checkpoints = idsOf(dimensions.checkpoints);
  const ids = new Set<string>();
  for (const entry of value) {
    const record = assertRecord(entry, 'cell');
    rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'cell');
    assertNonEmptyString(record.id, 'cell.id');
    if (ids.has(record.id)) {
      throw new FdmContractError('cells contain duplicated id');
    }
    ids.add(record.id);
    assertDimensionMember(record.profile, profiles, 'cell.profile');
    assertDimensionMember(record.dataset, datasets, 'cell.dataset');
    assertDimensionMember(record.compute, computes, 'cell.compute');
    assertDimensionMember(record.checkpoint, checkpoints, 'cell.checkpoint');
    assertCellStatus(record.status, 'cell.status');
    if (record.updatedAt !== undefined) assertNonEmptyString(record.updatedAt, 'cell.updatedAt');
    if (record.message !== undefined) assertNonEmptyString(record.message, 'cell.message');
    assertOptionalProgress(record.progress);
    if (record.resultRef !== undefined) assertNonEmptyString(record.resultRef, 'cell.resultRef');
  }
}

function assertRuntimeEvents(value: unknown): asserts value is readonly FdmRuntimeEvent[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('runtimeEvents must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'runtimeEvent');
    assertNonEmptyString(record.id, 'runtimeEvent.id');
    if (record.cellId !== undefined) assertNonEmptyString(record.cellId, 'runtimeEvent.cellId');
    assertCellStatus(record.status, 'runtimeEvent.status');
    assertNonEmptyString(record.message, 'runtimeEvent.message');
    assertNonEmptyString(record.occurredAt, 'runtimeEvent.occurredAt');
  }
}

function assertDirectoryEntries(value: unknown): asserts value is readonly FdmDirectoryEntry[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('directoryEntries must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'directoryEntry');
    rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'directoryEntry');
    assertNonEmptyString(record.id, 'directoryEntry.id');
    assertNonEmptyString(record.label, 'directoryEntry.label');
    if (typeof record.kind !== 'string' || !DIRECTORY_KINDS.has(record.kind)) {
      throw new FdmContractError('directoryEntry.kind is invalid');
    }
    assertStringArray(record.logicalPath, 'directoryEntry.logicalPath');
    if (record.resultRef !== undefined) {
      assertNonEmptyString(record.resultRef, 'directoryEntry.resultRef');
    }
  }
}

function assertResultLocations(value: unknown): asserts value is readonly FdmResultLocation[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('resultLocations must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'resultLocation');
    assertNonEmptyString(record.cellId, 'resultLocation.cellId');
    assertNonEmptyString(record.label, 'resultLocation.label');
    assertFiniteNumber(record.longitude, 'resultLocation.longitude');
    assertFiniteNumber(record.latitude, 'resultLocation.latitude');
    assertCellStatus(record.status, 'resultLocation.status');
    const longitude = record.longitude;
    const latitude = record.latitude;
    if (longitude < -180 || longitude > 180) {
      throw new FdmContractError('resultLocation.longitude is out of range');
    }
    if (latitude < -90 || latitude > 90) {
      throw new FdmContractError('resultLocation.latitude is out of range');
    }
  }
}

function assertConnectionState(value: unknown): asserts value is FdmDashboardConnectionState {
  if (typeof value !== 'string' || !CONNECTION_STATES.has(value as FdmDashboardConnectionState)) {
    throw new FdmContractError('connectionState is invalid');
  }
}

function assertCellStatus(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || !CELL_STATUSES.has(value)) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertAxisDimension(
  value: unknown
): asserts value is 'profile' | 'dataset' | 'checkpoint' | 'compute' {
  if (value !== 'profile' && value !== 'dataset' && value !== 'checkpoint' && value !== 'compute') {
    throw new FdmContractError('axis is invalid');
  }
}

function assertOptionalProgress(value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new FdmContractError('cell.progress must be a finite number from 0 to 100');
  }
}

function assertDimensionMember(value: unknown, members: Set<string>, fieldName: string): void {
  assertNonEmptyString(value, fieldName);
  if (!members.has(value)) {
    throw new FdmContractError(`${fieldName} is not declared in dimensions`);
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

function assertFiniteNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FdmContractError(`${fieldName} must be a finite number`);
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new FdmContractError(`${fieldName} must be a trimmed non-empty string`);
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

function idsOf(values: readonly FdmDimensionValue[]): Set<string> {
  return new Set(values.map((entry) => entry.id));
}

function matchesFilter(allowed: readonly string[], value: string): boolean {
  return allowed.length === 0 || allowed.includes(value);
}
