/**
 * データソースストラテジー基底クラス
 * DATA_SOURCE_STRATEGY_DESIGN.mdに基づく実装
 */

import { ShapeEntity } from '../../types/ShapeEntity';

// データソース設定の基本インターフェース
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

// アクセス設定
export interface AccessConfig {
  method: 'REST' | 'GraphQL' | 'File' | 'WebSocket' | 'FTP' | 'Custom';
  baseUrl?: string;
  endpoints?: Record<string, string>;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  retries?: RetryConfig;
}

// 認証設定
export interface AuthConfig {
  type: 'none' | 'api-key' | 'oauth' | 'basic' | 'bearer' | 'custom';
  credentials?: Record<string, string>;
  refreshStrategy?: RefreshStrategy;
}

// 処理設定
export interface ProcessingConfig {
  inputFormat: DataFormat;
  outputFormat: DataFormat;
  validation?: ValidationRule[];
  transformations?: TransformationRule[];
  filters?: FilterRule[];
  aggregations?: AggregationRule[];
}

// その他の型定義
export interface RateLimitConfig {
  requests: number;
  period: number; // ミリ秒
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

// データ取得オプション
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

// データ処理オプション
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

// バリデーション結果
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// 保存ターゲット
export interface SaveTarget {
  type: 'hierarchidb' | 'file' | 'database' | 'api';
  entityType?: string;
  parentId?: string;
  path?: string;
  format?: DataFormat;
  [key: string]: any;
}

// 保存結果
export interface SaveResult {
  success: boolean;
  entityId?: string;
  path?: string;
  count?: number;
  error?: string;
}

/**
 * データソース戦略の基本インターフェース
 */
export interface DataSourceStrategy<TRawData = any, TProcessedData = ShapeEntity[]> {
  readonly id: string;
  readonly name: string;
  readonly config: DataSourceConfig;
  
  // データ取得
  fetchData(options?: FetchOptions): Promise<TRawData>;
  
  // データ処理
  processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;
  
  // バリデーション
  validateData(data: TProcessedData): Promise<ValidationResult>;
  
  // 保存
  saveData(data: TProcessedData, target: SaveTarget): Promise<SaveResult>;
  
  // ヘルスチェック
  healthCheck?(): Promise<boolean>;
  
  // キャッシュクリア
  clearCache?(): Promise<void>;
}

/**
 * 抽象データソース戦略基底クラス
 */
export abstract class BaseDataSourceStrategy<TRawData = any, TProcessedData = ShapeEntity[]> 
  implements DataSourceStrategy<TRawData, TProcessedData> {
  
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly config: DataSourceConfig;

  abstract fetchData(options?: FetchOptions): Promise<TRawData>;
  abstract processData(rawData: TRawData, options?: ProcessOptions): Promise<TProcessedData>;

  async validateData(data: TProcessedData): Promise<ValidationResult> {
    // デフォルトのバリデーション実装
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        isValid: false,
        errors: ['データが空です']
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
        errors
      };
    }

    return { isValid: true, errors: [] };
  }

  async saveData(data: TProcessedData, target: SaveTarget): Promise<SaveResult> {
    // デフォルトの保存実装
    try {
      // HierarchiDBへの保存ロジックを実装
      return {
        success: true,
        count: Array.isArray(data) ? data.length : 1
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 基本的なヘルスチェック
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
    // キャッシュクリアのデフォルト実装
    console.log(`Cache cleared for ${this.id}`);
  }

  protected validateItem(item: any): boolean {
    // アイテム単体のバリデーション
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
      case 'eq': return value === filter.value;
      case 'ne': return value !== filter.value;
      case 'gt': return value > filter.value;
      case 'gte': return value >= filter.value;
      case 'lt': return value < filter.value;
      case 'lte': return value <= filter.value;
      case 'contains': return String(value).includes(String(filter.value));
      case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
      default: return true;
    }
  }

  private async applyTransformation(data: any[], transformation: TransformationRule): Promise<any[]> {
    switch (transformation.type) {
      case 'simplify':
        // 簡略化の実装
        return data; // TODO: 実装
      case 'filter':
        // フィルタリングの実装
        return data; // TODO: 実装
      default:
        return data;
    }
  }
}