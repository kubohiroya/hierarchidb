import type { TreeNodeMetadata, TreeNodeUpdaterPayload, NodeId as CommonNodeId } from '@hierarchidb/common-types';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult } from '@hierarchidb/ui-tabular-extract';
import type { BBox, Geometry } from 'geojson';
import type { DataSourceName, UrlMetadata } from './data-source.js';
import type { ProcessingConfig } from './processing.js';

export type NodeId = CommonNodeId;
export type NodeType = string;

export interface PeerEntity {
  id: NodeId;
  nodeId: NodeId;
  dialogMode?: 'normal' | 'full';
  resumeStep?: number;
  mapParams?: { zoom: number; lng: number; lat: number };
  disabled?: boolean;
}

export interface ShapeEntity extends PeerEntity {
  // Tree metadata (name/description/tags) is authoritative and lives in TreeNode metadata
  metadata?: TreeNodeMetadata;
  tabularMetadataId?: string;
  tabularFilters?: unknown; // kept broad; concrete type in data-source module
  tabularMetadata?: TabularTableMetadata | null;
  tabularFile?: TabularFileSummary;
  tabularLastPreview?: TabularDataResult;

  // Map Position
  zxy?: [number, number, number];

  // Data Source
  dataSourceName?: DataSourceName;

  // License Agreement
  licenseAgreement?: boolean;
  licenseAgreedAt?: string;

  // Processing Configuration
  processingConfig?: ProcessingConfig;

  // Country & Admin Selection
  checkboxState?: boolean[][] | string;
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];

  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
}

// Draft payload via TreeNodeUpdaterPayload; name/description/tags live only in draftMetadata/metadata.
export type ShapeDraft = TreeNodeUpdaterPayload<ShapeEntity>;

export interface StepProps {
  draft: Partial<ShapeDraft['draftData']> | null;
  onUpdate: (updates: Partial<ShapeDraft['draftData']>) => void;
  disabled?: boolean;
  mode?: 'create' | 'edit';
}

export interface TabularFileSummary {
  name: string;
  sizeBytes: number;
  type?: string;
  lastModifiedAt?: number;
}

export interface Feature {
  type: 'Feature';
  id: number;
  originalId?: string | number;
  nodeId: NodeId;
  properties: Record<string, any>;
  geometry: Geometry;
  bbox?: BBox;
  mortonCode?: bigint;
  adminLevel?: number;
  countryCode?: string;
  name?: string;
  nameEn?: string;
  population?: number;
  area?: number;
}

export interface VectorTileEntity {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: any[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}
