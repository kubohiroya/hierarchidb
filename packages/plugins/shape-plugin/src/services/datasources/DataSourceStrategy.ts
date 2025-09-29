/**
   * DATA_SOURCE_STRATEGY_DESIGN.md
  */

import type { ShapeEntity } from '../../shared/types.js';

export interface DataSourceConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  access: AccessConfig;
  processing: ProcessingConfig;
  schedule?: ScheduleConfig;
  cache?: CacheConfig;
}

export interface AccessConfig {
  method: 'REST' | 'GraphQL' | 'File' | 'WebSocket' | 'FTP' | 'Custom';
  baseUrl?: string;
  endpoints?: Record<string, string>;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retries?: RetryConfig;
}

export interface AuthConfig {
  type: 'none' | 'api-key' | 'oauth' | 'basic' | 'bearer' | 'custom';
  credentials?: Record<string, string>;
  refreshStrategy?: RefreshStrategy;
}

export interface ProcessingConfig {
  inputFormat: DataFormat;
  outputFormat: DataFormat;
  validation?: ValidationRule[];
  transformations?: TransformationRule[];
  filters?: FilterRule[];
  aggregations?: AggregationRule[];
}

export interface RateLimitConfig {
  requests: number;
  period: number;
}

export interface RetryConfig {
  count: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
}

export interface RefreshStrategy {
  type: 'auto' | 'manual';
  interval?: number;
}

export interface ScheduleConfig {
  cron?: string;
  interval?: number;
  immediate?: boolean;
}

export interface CacheConfig {
  ttl: number;
  strategy: 'memory' | 'disk' | 'etag' | 'none';
}

export type DataFormat = 'shapefile' | 'geojson' | 'json' | 'csv' | 'xml' | 'kml' | 'gpx';

export interface ValidationRule {
  field: string;
  rule: 'required' | 'type' | 'range' | 'pattern';
  value?: any;
}

export interface TransformationRule {
  type: 'coordinate-system' | 'simplify' | 'project' | 'filter' | 'aggregate';
  from?: string;
  to?: string;
  tolerance?: number;

  [key: string]: any;
}

export interface FilterRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface AggregationRule {
  type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'group';
  field?: string;
  groupBy?: string;
}

export interface FetchOptions {
  bbox?: BoundingBox;
  adminLevel?: number;
  endpoint?: string;
  query?: string;
  country?: string;
  featureClass?: string;
  maxRows?: number;
  tags?: TagFilter[];
  timeout?: number;
  filters?: FilterRule[];
  geoFilters?: GeographicFilter[];

  [key: string]: any;
}

export interface ProcessOptions {
  filters?: FilterRule[];
  transformations?: TransformationRule[];
  validation?: boolean;
  outputFormat?: DataFormat;
  simplify?: boolean;
  tolerance?: number;

  [key: string]: any;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface TagFilter {
  key: string;
  value?: string;
  operator?: 'eq' | 'ne' | 'exists' | 'not_exists';
}

export interface GeographicFilter {
  type: 'bbox' | 'circle' | 'polygon';
  coordinates: number[] | number[][];
  radius?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SaveTarget {
  type: 'hierarchidb' | 'file' | 'database' | 'api';
  entityType?: string;
  parentId?: string;
  path?: string;
  format?: DataFormat;

  [key: string]: any;
}

export interface SaveResult {
  success: boolean;
  entityId?: string;
  path?: string;
  count?: number;
  error?: string;
}

/**
    */
export interface DataSourceStrategy<TRawData = any, TProcessedData = ShapeEntity[]> {
  readonly id: string;
  readonly name: string;
  readonly config: DataSourceConfig;

  fetchData(options?: FetchOptions): Promise<TRawData>;

  processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;

  validateData(data: TProcessedData): Promise<ValidationResult>;

  saveData(data: TProcessedData, target: SaveTarget): Promise<SaveResult>;

  healthCheck?(): Promise<boolean>;

  clearCache?(): Promise<void>;
}

/**
    */
export abstract class BaseDataSourceStrategy<TRawData = any, TProcessedData = ShapeEntity[]>
  implements DataSourceStrategy<TRawData, TProcessedData> {

  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly config: DataSourceConfig;

  abstract fetchData(options?: FetchOptions): Promise<TRawData>;

  abstract processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;

  async validateData(data: TProcessedData): Promise<ValidationResult> {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        isValid: false,
        errors: ['データが空です'],
      };
    }

    if (Array.isArray(data)) {
      const errors: string[] = [];
      data.forEach((item, index) => {
        if (!this.validateItem(item)) {
          errors.push(`アイテム ${index}: 無効なデータ形式`);
        }
      });

      return {
        isValid: errors.length === 0,
        errors,
      };
    }

    return { isValid: true, errors: [] };
  }

  async saveData(data: TProcessedData, _target: SaveTarget): Promise<SaveResult> {
    try {
      //  HierarchiDB
      return {
        success: true,
        count: Array.isArray(data) ? data.length : 1,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.config.access.baseUrl) {
        const response = await fetch(this.config.access.baseUrl);
        return response.ok;
      }
      return true;
    } catch {
      return false;
    }
  }

  async clearCache(): Promise<void> {
    console.log(`Cache cleared for ${this.id}`);
  }

  protected validateItem(item: any): boolean {
    return item && typeof item === 'object';
  }

  protected async applyFilters(data: any[], filters?: FilterRule[]): Promise<any[]> {
    if (!filters || filters.length === 0) {
      return data;
    }

    return data.filter(item => {
      return filters.every(filter => {
        const value = this.getNestedValue(item, filter.field);
        return this.applyFilterRule(value, filter);
      });
    });
  }

  protected async applyTransformations(data: any[], transformations?: TransformationRule[]): Promise<any[]> {
    if (!transformations || transformations.length === 0) {
      return data;
    }

    let result = data;
    for (const transformation of transformations) {
      result = await this.applyTransformation(result, transformation);
    }
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private applyFilterRule(value: any, filter: FilterRule): boolean {
    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'gt':
        return value > filter.value;
      case 'gte':
        return value >= filter.value;
      case 'lt':
        return value < filter.value;
      case 'lte':
        return value <= filter.value;
      case 'contains':
        return String(value).includes(String(filter.value));
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      default:
        return true;
    }
  }

  private async applyTransformation(data: any[], transformation: TransformationRule): Promise<any[]> {
    switch (transformation.type) {
      case 'simplify':
        return data;
      case 'filter':
        return data;
      default:
        return data;
    }
  }
}
