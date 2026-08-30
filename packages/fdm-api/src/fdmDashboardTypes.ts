import type { FdmAxisDimension, FdmAxisMap, FdmFilters, FdmNodeData } from './fdmTypes.js';

export type FdmCellStatus = 'idle' | 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed';
export type FdmDashboardConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'stale';

export interface FdmDimensionValue extends Record<string, unknown> {
  readonly id: string;
  readonly label: string;
}

export interface FdmDashboardDimensions extends Record<string, unknown> {
  readonly profiles: readonly FdmDimensionValue[];
  readonly datasets: readonly FdmDimensionValue[];
  readonly computes: readonly FdmDimensionValue[];
  readonly checkpoints: readonly FdmDimensionValue[];
}

export interface FdmDashboardCell extends Record<string, unknown> {
  readonly id: string;
  readonly profile: string;
  readonly dataset: string;
  readonly compute: string;
  readonly checkpoint: string;
  readonly status: FdmCellStatus;
  readonly updatedAt?: string;
  readonly message?: string;
  readonly progress?: number;
  readonly resultRef?: string;
}

export interface FdmDashboardSummary extends Record<string, unknown> {
  readonly totalCells: number;
  readonly succeeded: number;
  readonly running: number;
  readonly failed: number;
  readonly blocked: number;
}

export interface FdmRuntimeEvent extends Record<string, unknown> {
  readonly id: string;
  readonly cellId?: string;
  readonly status: FdmCellStatus;
  readonly message: string;
  readonly occurredAt: string;
}

export interface FdmDirectoryEntry extends Record<string, unknown> {
  readonly id: string;
  readonly label: string;
  readonly kind: 'directory' | 'file' | 'result';
  readonly logicalPath: readonly string[];
  readonly resultRef?: string;
}

export interface FdmResultLocation extends Record<string, unknown> {
  readonly cellId: string;
  readonly label: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly status: FdmCellStatus;
}

export interface FdmDashboardResponse extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly connectionState: FdmDashboardConnectionState;
  readonly spaceLabel: string;
  readonly stateDirectories: readonly string[];
  readonly selectedStateDir?: string;
  readonly dimensions: FdmDashboardDimensions;
  readonly cells: readonly FdmDashboardCell[];
  readonly runtimeEvents: readonly FdmRuntimeEvent[];
  readonly logs: readonly string[];
  readonly directoryEntries: readonly FdmDirectoryEntry[];
  readonly resultLocations: readonly FdmResultLocation[];
  readonly refreshedAt: string;
}

export interface FdmDashboardQuery extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly selectedStateDir?: string;
  readonly signal: AbortSignal;
}

export interface FdmDashboardActionInput extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly action: 'refresh' | 'reconnect' | 'run-selected' | 'open-result';
  readonly selectedCellId?: string;
  readonly signal: AbortSignal;
}

export interface FdmDashboardPort {
  readonly loadDashboard: (query: FdmDashboardQuery) => Promise<FdmDashboardResponse>;
  readonly performAction: (input: FdmDashboardActionInput) => Promise<FdmDashboardResponse>;
}

export const FDM_CELL_STATUSES: readonly FdmCellStatus[] = [
  'idle',
  'queued',
  'running',
  'blocked',
  'succeeded',
  'failed',
] as const;

export const FDM_AXIS_TO_COLLECTION: Record<FdmAxisDimension, keyof FdmDashboardDimensions> = {
  profile: 'profiles',
  dataset: 'datasets',
  checkpoint: 'checkpoints',
  compute: 'computes',
};
