import type { ShapeBuildConfig, ShapeProcessingConfig } from './BuildTaskResult.js';
import type { SelectedArrayByCountries } from './ShapeEntity.ts';

export interface CreateShapeData {
  buildConfig: ShapeBuildConfig;
  processingConfig: ShapeProcessingConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}

export interface UpdateShapeData {
  buildConfig?: ShapeBuildConfig;
  processingConfig?: ShapeProcessingConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
}
