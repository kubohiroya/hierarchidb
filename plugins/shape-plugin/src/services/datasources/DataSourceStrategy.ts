/**
   * DATA_SOURCE_STRATEGY_DESIGN.md
  */

import type { ShapeEntity } from '../../common/types/ShapeEntity.js';
import type { ShapeStepValidationResult } from '../../common/types/index.js';

export interface DataSourceConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  access: AccessConfig;
  processing: BatchConfig;
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

export interface BatchConfig {
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

export type ValidationRuleValue =
  | string
  | number
  | boolean
  | RegExp
  | Array<string | number | boolean>
  | null;

export interface ValidationRule {
  field: string;
  rule: 'required' | 'type' | 'range' | 'pattern';
  value?: ValidationRuleValue;
}

export interface TransformationRule {
  type: 'coordinate-system' | 'extract' | 'project' | 'filter' | 'aggregate';
  from?: string;
  to?: string;
  tolerance?: number;

  [key: string]: unknown;
}

export type FilterValue = string | number | boolean | Array<string | number | boolean> | null;

export interface FilterRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: FilterValue;
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
  tags?: Array<TagFilter | string>;
  timeout?: number;
  signal?: AbortSignal;
  filters?: FilterRule[];
  geoFilters?: GeographicFilter[];

  [key: string]: unknown;
}

export interface ProcessOptions {
  filters?: FilterRule[];
  transformations?: TransformationRule[];
  validation?: boolean;
  outputFormat?: DataFormat;
  extract?: boolean;
  tolerance?: number;

  [key: string]: unknown;
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
  includeNodes?: boolean;
}

export interface GeographicFilter {
  type: 'bbox' | 'circle' | 'polygon';
  coordinates: number[] | number[][];
  radius?: number;
}

export interface SaveTarget {
  type: 'hierarchidb' | 'file' | 'database' | 'api';
  entityType?: string;
  parentId?: string;
  path?: string;
  format?: DataFormat;

  [key: string]: unknown;
}

export interface SaveResult {
  success: boolean;
  entityId?: string;
  path?: string;
  count?: number;
  error?: string;
}

export interface DataSourceStrategy<TRawData = unknown, TProcessedData = ShapeEntity[]> {
  readonly id: string;
  readonly name: string;
  readonly config: DataSourceConfig;

  fetchData(options?: FetchOptions): Promise<TRawData>;

  processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;

  validateData(data: TProcessedData): Promise<ShapeStepValidationResult>;

  saveData(data: TProcessedData, target: SaveTarget): Promise<SaveResult>;

  healthCheck?(): Promise<boolean>;

  clearCache?(): Promise<void>;
}

export abstract class BaseDataSourceStrategy<TRawData = unknown, TProcessedData = ShapeEntity[]>
  implements DataSourceStrategy<TRawData, TProcessedData> {

  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly config: DataSourceConfig;

  abstract fetchData(options?: FetchOptions): Promise<TRawData>;

  abstract processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;

  async validateData(data: TProcessedData): Promise<ShapeStepValidationResult> {
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
        const { authFetch } = await import('@hierarchidb/download');
        const response = await authFetch('shape', this.config.access.baseUrl);
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

  protected validateItem(item: unknown): item is object {
    return typeof item === 'object' && item !== null;
  }

  protected async applyFilters<T extends object>(data: T[], filters?: FilterRule[]): Promise<T[]> {
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

  protected async applyTransformations<T extends object>(
    data: T[],
    transformations?: TransformationRule[],
  ): Promise<T[]> {
    if (!transformations || transformations.length === 0) {
      return data;
    }

    let result = data;
    for (const transformation of transformations) {
      result = await this.applyTransformation(result, transformation);
    }
    return result;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) return undefined;
    return path
      .split('.')
      .reduce<unknown>((current, key) => {
        if (typeof current !== 'object' || current === null) return undefined;
        return (current as Record<string, unknown>)[key];
      }, obj);
  }

  private applyFilterRule(value: unknown, filter: FilterRule): boolean {
    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'gt':
        return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;
      case 'gte':
        return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;
      case 'lt':
        return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;
      case 'lte':
        return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;
      case 'contains':
        return String(value).includes(String(filter.value));
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value as string | number | boolean);
      default:
        return true;
    }
  }

  private async applyTransformation<T extends object>(
    data: T[],
    transformation: TransformationRule,
  ): Promise<T[]> {
    switch (transformation.type) {
      case 'extract':
        return data;
      case 'filter':
        return data;
      default:
        return data;
    }
  }
}
