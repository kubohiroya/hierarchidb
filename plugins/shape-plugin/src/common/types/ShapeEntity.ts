import type { ISO2, PeerEntity } from '@hierarchidb/core-types';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { ShapeBuildConfig } from './build.js';

export interface ShapePreviewMapView {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface ShapeStageTimingSnapshot {
  startedAt: number;
  inactiveMs: number;
  lastHeartbeatAt?: number;
  endedAt?: number;
}

export interface ShapeEntityPayload {
  licenseAgreement?: boolean;
  licenseAgreedAt?: string;

  buildConfig?: ShapeBuildConfig;

  selectedArrayByCountries?: SelectedArrayByCountries;
  //batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'paused' | 'completed' | 'failed';
  stopReason?: ShapeBuildStopReason;
  buildStartedAt?: number;
  buildFinishedAt?: number;
  buildElapsedMs?: number;
  buildResumedAt?: number;
  stageElapsedMs?: number;
  stageResumedAt?: number;
  stageElapsedStageId?: string;
  stageElapsedByStage?: Record<string, number>;
  stageTimingByStage?: Record<string, ShapeStageTimingSnapshot>;

  // UI Preview
  previewMapView?: ShapePreviewMapView;
}

export type ShapeEntity = PeerEntity<ShapeEntityPayload>;

export type SelectedArrayByCountries = Record<ISO2, boolean[]>;
