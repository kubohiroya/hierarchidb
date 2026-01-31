import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmRouteError } from './ideGsmRouteCsv.js';

export type IdeGsmRouteImportRequest = {
  nodeId: NodeId;
  sourceUrl: string;
  locationNodeIds?: NodeId[];
  chunkSize?: number;
};

export type IdeGsmRouteImportResult = {
  saved: number;
  errorCount: number;
  errors: IdeGsmRouteError[];
};
