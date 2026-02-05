import type { ISO2, NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { Geometry } from 'geojson';
import type { ShapeBuildConfig } from './build.js';

export interface ShapePreviewMapView {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface ShapeEntity {
  // Identifiers
  //id?: string;
  nodeId?: NodeId;

  // Geometry / properties
  geometry?: Geometry;
  properties?: Record<string, unknown>;

  //tabularMetadataId?: string;
  //tabularFilters?: unknown; // kept broad; concrete type in data-source module
  //tabularMetadata?: TabularTableMetadata | null;
//tabularFile?: TabularFileSummary;
  //tabularLastPreview?: TabularDataResult;

  // License Agreement
  licenseAgreement?: boolean;
  licenseAgreedAt?: string;

  // Processing Configuration
  buildConfig?: ShapeBuildConfig;

// Country & Admin Selection
  selectedArrayByCountries?: SelectedArrayByCountries;
  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'paused' | 'completed' | 'failed';
  stopReason?: ShapeBuildStopReason;
  tileSummary?: { tiles: number; totalBytes: number; zoomMin?: number; zoomMax?: number };
  buildStartedAt?: number;
  buildFinishedAt?: number;

  // UI Preview
  previewMapView?: ShapePreviewMapView;
}

export type SelectedArrayByCountries = Record<ISO2, boolean[]>;
