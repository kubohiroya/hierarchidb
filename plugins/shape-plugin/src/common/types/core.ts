import type { TreeNodeUpdaterPayload, NodeId } from '@hierarchidb/common-types';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import type { TabularDataResult } from '@hierarchidb/ui-tabular-extract';
import type { BBox, Geometry } from 'geojson';
import type { LayerInfo } from './batch.js';
import type { DataSourceName, UrlMetadata } from './data-source.js';
import type { ProcessingConfig } from './processing.js';

export interface ShapeEntity {
  // Identifiers
  id?: string;
  nodeId?: NodeId;

  // Geometry / properties
  geometry?: Geometry;
  properties?: Record<string, unknown>;

  // Metadata for display
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
  };

  // Timestamps / versioning
  createdAt?: number;
  updatedAt?: number;
  version?: number;

  tabularMetadataId?: string;
  tabularFilters?: unknown; // kept broad; concrete type in data-source module
  tabularMetadata?: TabularTableMetadata | null;
//tabularFile?: TabularFileSummary;
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

export type ShapeDraft = TreeNodeUpdaterPayload<ShapeEntity>;

/*
// Draft payload via TreeNodeUpdaterPayload; name/description/tags live only in draftMetadata/metadata.

export interface StepProps {
  draft: Partial<ShapeDraft['draftData']> | null;
  onUpdate: (updates: Partial<ShapeDraft['draftData']>) => void;
  disabled?: boolean;
  mode?: 'create' | 'edit';
}
*/
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
  properties: Record<string, unknown>;
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
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: LayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}
