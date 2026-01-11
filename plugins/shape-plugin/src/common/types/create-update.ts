
import type { BatchConfig } from './processing.js';
import type { SelectedArrayByCountries } from './ShapeEntity.ts';

export interface CreateShapeData {
  batchConfig: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}
