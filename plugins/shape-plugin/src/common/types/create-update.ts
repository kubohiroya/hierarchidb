import type { DataSourceName } from './data-source.js';
import type { BatchConfig } from './processing.js';
import type { UrlMetadata } from './data-source.js';

export interface CreateShapeData {
  batchConfig: BatchConfig;
  dataSourceName?: DataSourceName;
  checkboxState?: boolean[][] | string;
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  checkboxState?: boolean[][] | string;
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];
}
