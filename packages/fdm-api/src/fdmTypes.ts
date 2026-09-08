import type { NodeId } from '@hierarchidb/core-types';
import type { FdmCapabilitiesPayload, IdeGsmFdmSpace } from '@hierarchidb/ide-gsm-client';

export const FDM_NODE_TYPE = 'fdm' as const;
export const FDM_NODE_DATA_VERSION = 1 as const;

export type FdmViewMode = 'lattice-3d' | 'matrix-2d' | 'map';
export type FdmCanonicalAxisDimension = 'parameterSet' | 'dataset' | 'timeline' | 'compute';
export type FdmLegacyAxisDimension = 'profile' | 'checkpoint';
export type FdmAxisDimension = FdmCanonicalAxisDimension | FdmLegacyAxisDimension;

export interface FdmFilters extends Record<string, unknown> {
  readonly parameterSets: readonly string[];
  readonly datasets: readonly string[];
  readonly computes: readonly string[];
  readonly timelines: readonly string[];
  readonly rangeProfiles?: readonly string[];
  /** @deprecated Use parameterSets. */
  readonly profiles?: readonly string[];
  /** @deprecated Use timelines. */
  readonly checkpoints?: readonly string[];
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
  readonly capabilities?: FdmCapabilitiesPayload | null;
  readonly entries?: readonly FdmSpaceCatalogEntry[];
}

export type FdmSpaceKind = 'baseline' | 'working' | 'fork' | 'archived' | 'unknown';
export type FdmProjectionAvailability = 'available' | 'unavailable' | 'stale' | 'unsupported';

export interface FdmSpaceCatalogMetadata extends Record<string, unknown> {
  readonly defaultSpace?: boolean;
  readonly visible?: boolean;
  readonly archived?: boolean;
  readonly owner?: string;
  readonly layoutVersion?: string;
  readonly legacyRoot?: boolean;
  readonly order?: number;
  readonly createdAt?: string;
  readonly warnings?: readonly string[];
  readonly defaults?: IdeGsmFdmSpace['defaults'];
}

export interface FdmSpaceCapabilityProjection extends Record<string, unknown> {
  readonly canRead: boolean;
  readonly canUpdate?: boolean;
  readonly canArchive?: boolean;
  readonly canDelete?: boolean;
  readonly canFork?: boolean;
  readonly canViewAcrossSpaces?: boolean;
  readonly source: 'server' | 'unavailable';
  readonly reason?: string;
  readonly serverCapabilities?: readonly string[];
  readonly baselineCount?: number;
  readonly forkCount?: number;
  readonly lineageCount?: number;
}

export interface FdmSpaceProvenanceProjection extends Record<string, unknown> {
  readonly status: FdmProjectionAvailability;
  readonly spaceId: string;
  readonly baselineSpaceId?: string;
  readonly forkParentSpaceId?: string;
  readonly source?: string;
  readonly reason?: string;
}

export interface FdmProjectionOrigin extends Record<string, unknown> {
  readonly spaceId: string;
  readonly baselineSpaceId?: string;
  readonly forkParentSpaceId?: string;
  readonly source?: string;
}

export interface FdmSpaceCatalogEntry extends Record<string, unknown> {
  readonly spaceId: string;
  readonly label?: string;
  readonly kind: FdmSpaceKind;
  readonly catalog: FdmSpaceCatalogMetadata;
  readonly capability: FdmSpaceCapabilityProjection;
  readonly provenance: FdmSpaceProvenanceProjection;
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
