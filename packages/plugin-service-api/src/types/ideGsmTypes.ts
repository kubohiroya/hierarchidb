import type { CountryCode, NodeId } from '@hierarchidb/common-types';

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

export type IdeGsmSelectionEntry = {
  countryCode: CountryCode;
  countryName: string;
  types: string[];
};

export type IdeGsmLocationPointInput = {
  lon: number;
  lat: number;
  id?: string | number;
  properties?: Record<string, unknown>;
};

export type IdeGsmRouteError = {
  id: string;
  rowNumber: number;
  start: string;
  end: string;
  reason: string;
};

export type IdeGsmLocationImportRequest = {
  nodeId: NodeId;
  sourceUrl: string;
  selectionEntries: IdeGsmSelectionEntry[];
  chunkSize?: number;
};

export type IdeGsmLocationImportResult = {
  points: IdeGsmLocationPointInput[];
  total: number;
};

export type IdeGsmRouteImportRequest = {
  nodeId: NodeId;
  sourceUrl: string;
  locationNodeIds: NodeId[];
  chunkSize?: number;
};

export type IdeGsmRouteImportResult = {
  saved: number;
  errorCount: number;
  errors: IdeGsmRouteError[];
};
