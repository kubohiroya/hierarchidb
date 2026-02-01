import type { ISO2, NodeId } from '@hierarchidb/core-types';
import type { IdeGsmRouteError } from './ideGsmRouteCsv.js';
import type { RouteMode } from './routeTypes.js';

export type IdeGsmRouteImportRequest = {
  nodeId: NodeId;
  tabularSourceId: string;
  locationNodeIds?: NodeId[];
  chunkSize?: number;
};

export type IdeGsmRouteImportResult = {
  saved: number;
  errorCount: number;
  errors: IdeGsmRouteError[];
};

export type IdeGsmRouteCoverageResult = {
  coverageByCountry: Record<ISO2, RouteMode[]>;
  rowCount: number;
  errorCount: number;
  errors: IdeGsmRouteError[];
};
