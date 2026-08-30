import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmFdmSpace } from '@hierarchidb/ide-gsm-client';

export const FDM_NODE_TYPE = 'fdm' as const;
export const FDM_NODE_DATA_VERSION = 1 as const;

export type FdmViewMode = 'lattice-3d' | 'matrix-2d' | 'map';
export type FdmAxisDimension = 'profile' | 'dataset' | 'checkpoint' | 'compute';

export interface FdmFilters extends Record<string, unknown> {
  readonly profiles: readonly string[];
  readonly datasets: readonly string[];
  readonly computes: readonly string[];
  readonly checkpoints: readonly string[];
}

export interface FdmAxisMap extends Record<string, unknown> {
  readonly xOuter: FdmAxisDimension;
  readonly xInner: FdmAxisDimension;
  readonly y: FdmAxisDimension;
  readonly z: FdmAxisDimension;
}

export interface FdmNodeData extends Record<string, unknown> {
  readonly version: typeof FDM_NODE_DATA_VERSION;
  readonly connectionName: string;
  readonly spaceId: string;
  readonly idegsmProjectNodeId?: NodeId;
  readonly selectedStateDir?: string;
  readonly viewMode: FdmViewMode;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly tabularSnapshotRefs: readonly string[];
}

export interface FdmNodeIdentity extends Record<string, unknown> {
  readonly connectionName: string;
  readonly spaceId: string;
}

export interface FdmDialogData extends Record<string, unknown> {
  readonly connectionName?: string;
  readonly spaceId?: string;
  readonly idegsmProjectNodeId?: NodeId;
  readonly selectedStateDir?: string;
  readonly viewMode?: FdmViewMode;
  readonly filters?: FdmFilters;
  readonly axisMap?: FdmAxisMap;
  readonly tabularSnapshotRefs?: readonly string[];
}

export interface FdmSpaceCatalog extends Record<string, unknown> {
  readonly defaultSpaceId: string;
  readonly spaces: readonly IdeGsmFdmSpace[];
}

export interface FdmSpaceCreateInput extends Record<string, unknown> {
  readonly connectionName: string;
  readonly requestedName?: string;
  readonly signal: AbortSignal;
}

export interface FdmPromotionInput extends Record<string, unknown> {
  readonly mode: 'create' | 'edit';
  readonly treeId?: string;
  readonly nodeId?: string;
  readonly parentId?: string;
  readonly currentNodeVersion?: number;
  readonly draft: FdmDialogData;
  readonly signal: AbortSignal;
  readonly setPhase: (phase: string) => void;
  readonly setCancellable: (cancellable: boolean) => void;
}

export interface FdmPromotionResult extends Record<string, unknown> {
  readonly nodeId?: string;
  readonly nodeVersion?: number;
  readonly data: FdmNodeData;
}

export interface FdmRuntimePort {
  readonly listSpaces: (connectionName: string, signal: AbortSignal) => Promise<FdmSpaceCatalog>;
  readonly createSpace?: (input: FdmSpaceCreateInput) => Promise<IdeGsmFdmSpace>;
  readonly promoteNode: (input: FdmPromotionInput) => Promise<FdmPromotionResult>;
}

export class FdmContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FdmContractError';
  }
}
