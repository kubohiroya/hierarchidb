import type { DataSourceName } from './data-source.js';
import type { BatchConfig } from './processing.js';
import type { UrlMetadata } from './data-source.js';

export interface CreateShapeData {
  batchConfig: BatchConfig;
  dataSourceName?: DataSourceName;
  selectedArrayByCountries?: boolean[][] | string;
  urlMetadata?: UrlMetadata[];
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: boolean[][] | string;
  urlMetadata?: UrlMetadata[];
}
