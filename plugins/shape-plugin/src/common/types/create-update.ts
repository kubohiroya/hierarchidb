import type { DataSourceName } from './data-source.js';
import type { ProcessingConfig } from './processing.js';
import type { UrlMetadata } from './data-source.js';

export interface CreateShapeData {
  dataSourceName: DataSourceName;
  processingConfig: ProcessingConfig;
  checkboxState?: boolean[][] | string;
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];
}

export interface UpdateShapeData {
  processingConfig?: ProcessingConfig;
  checkboxState?: boolean[][] | string;
  selectedCountries?: string[];
  adminLevels?: number[];
  urlMetadata?: UrlMetadata[];
}
