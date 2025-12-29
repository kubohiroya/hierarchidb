import type { DataSourceName } from './data-source.js';
import type { SelectedArrayByCountries } from './ShapeEntity.ts';
import type { BatchConfig } from './processing.js';

export interface CreateShapeData {
  batchConfig: BatchConfig;
  dataSourceName?: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}
