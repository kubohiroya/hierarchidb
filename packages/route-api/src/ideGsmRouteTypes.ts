import type { ISO2, NodeId } from '@hierarchidb/core-types';
import type { IdeGsmRouteError } from './ideGsmRouteCsv.js';
import type { RouteMode } from './routeTypes.js';

export type IdeGsmRouteSelectionEntry = {
  countryCode: ISO2;
  countryName?: string;
  orModes: RouteMode[];
  andModes: RouteMode[];
};

export type IdeGsmRouteImportRequest = {
  nodeId: NodeId;
  tabularSourceId: string;
  locationNodeIds?: NodeId[];
  selectionEntries?: IdeGsmRouteSelectionEntry[];
  chunkSize?: number;
};

export type IdeGsmRouteImportResult = {
  saved: number;
  errorCount: number;
  errors: IdeGsmRouteError[];
};

export type IdeGsmRouteCoverageResult = {
  coverageByCountryOr: Record<ISO2, RouteMode[]>;
  coverageByCountryAnd: Record<ISO2, RouteMode[]>;
  /**
   * Backward-compatible alias for OR coverage.
   */
  coverageByCountry: Record<ISO2, RouteMode[]>;
  rowCount: number;
  errorCount: number;
  errors: IdeGsmRouteError[];
};
