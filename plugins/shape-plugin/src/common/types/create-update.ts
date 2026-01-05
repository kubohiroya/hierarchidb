import type { SelectedArrayByCountries } from './ShapeEntity.ts';
import type { BatchConfig } from './processing.js';

export interface CreateShapeData {
  batchConfig: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}
