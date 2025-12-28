import type { DataSourceName } from './data-source.js';
import type { BatchConfig } from './processing.js';

export interface CreateShapeData {
  batchConfig: BatchConfig;
  dataSourceName?: DataSourceName;
  selectedArrayByCountries?: boolean[][];
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: boolean[][];
}
