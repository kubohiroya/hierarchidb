import type { ShapeBuildConfig } from './build.js';
import type { SelectedArrayByCountries } from './ShapeEntity.ts';

export type BatchConfig = ShapeBuildConfig;

export interface CreateShapeData {
  batchConfig: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}

export interface UpdateShapeData {
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}
