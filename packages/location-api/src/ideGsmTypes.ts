import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmSelectionEntry } from './locationTypes.js';

export type IdeGsmImportPhase =
  | 'fetch'
  | 'parse'
  | 'filter'
  | 'waypoints'
  | 'save'
  | 'completed'
  | 'failed';

export const IDE_GSM_BULK_CHUNK_SIZE = 1000;

export type IdeGsmImportProgress = {
  phase: IdeGsmImportPhase;
  total?: number;
  processed?: number;
  chunk?: number;
  chunkSize?: number;
  message?: string;
  timestamp: number;
};

export type IdeGsmImportCallback = (progress: IdeGsmImportProgress) => void;

export type IdeGsmLocationPointInput = {
  lon: number;
  lat: number;
  id?: string | number;
  properties?: Record<string, unknown>;
};

export type IdeGsmLocationImportRequest = {
  nodeId: NodeId;
  tabularSourceId: string;
  selectionEntries: IdeGsmSelectionEntry[];
  chunkSize?: number;
  mode?: 'replace' | 'append' | 'upsert';
};

export type IdeGsmLocationImportResult = {
  points: IdeGsmLocationPointInput[];
  total: number;
};
