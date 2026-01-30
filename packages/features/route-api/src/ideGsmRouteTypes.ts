import type { NodeId } from '@hierarchidb/common-types';
import type { IdeGsmRouteError } from './ideGsmCsv.js';

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
