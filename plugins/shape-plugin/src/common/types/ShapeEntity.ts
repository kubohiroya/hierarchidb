import type { ISO2, PeerEntity } from '@hierarchidb/core-types';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { Geometry } from 'geojson';
import type { ShapeBuildConfig } from './build.js';

export interface ShapePreviewMapView {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface ShapeEntityPayload {
  geometry?: Geometry;
  //properties?: Record<string, unknown>;

  licenseAgreement?: boolean;
  licenseAgreedAt?: string;

  buildConfig?: ShapeBuildConfig;

  selectedArrayByCountries?: SelectedArrayByCountries;
  //batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'paused' | 'completed' | 'failed';
  stopReason?: ShapeBuildStopReason;
  tileSummary?: { tiles: number; totalBytes: number; zoomMin?: number; zoomMax?: number };
  buildStartedAt?: number;
  buildFinishedAt?: number;

  // UI Preview
  previewMapView?: ShapePreviewMapView;
}

export type ShapeEntity = PeerEntity<ShapeEntityPayload>;

export type SelectedArrayByCountries = Record<ISO2, boolean[]>;
