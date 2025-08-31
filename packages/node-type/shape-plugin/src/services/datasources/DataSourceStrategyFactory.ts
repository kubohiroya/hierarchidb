/**
 * データソース戦略ファクトリー
 * DATA_SOURCE_STRATEGY_DESIGN.mdに基づく実装
 */

import { DataSourceStrategy } from './DataSourceStrategy';
import { NaturalEarthStrategy } from './NaturalEarthStrategy';
import { GADMStrategy } from './GADMStrategy';
import { OpenStreetMapStrategy } from './OpenStreetMapStrategy';
import { GeoBoundariesStrategy } from './GeoBoundariesStrategy';

export type DataSourceStrategyId = 
  | 'natural-earth-shapes'
  | 'gadm-administrative-areas'
  | 'openstreetmap-overpass'
  | 'geoboundaries-admin-areas';

/**
 * データソース戦略の情報
 */
export interface DataSourceInfo {
  id: DataSourceStrategyId;
  name: string;
  description: string;
  category: 'administrative' | 'natural' | 'infrastructure' | 'general';
  dataTypes: string[];
  coverageLevel: 'global' | 'regional' | 'national' | 'local';
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'irregular';
  license: string;
  attribution: string;
  supported: boolean;
}

/**
 * データソース戦略ファクトリー
 */
export class DataSourceStrategyFactory {
  private strategies = new Map<DataSourceStrategyId, () => DataSourceStrategy>();
  private strategyInfo = new Map<DataSourceStrategyId, DataSourceInfo>();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * デフォルトの戦略を登録
   */
  private registerDefaultStrategies(): void {
    // Natural Earth戦略
    this.register(
      'natural-earth-shapes',
      () => new NaturalEarthStrategy(),
      {
        id: 'natural-earth-shapes',
        name: 'Natural Earth',
        description: 'Free vector and raster map data at multiple scales',
        category: 'general',
        dataTypes: ['countries', 'states', 'cities', 'coastlines', 'rivers', 'lakes'],
        coverageLevel: 'global',
        updateFrequency: 'yearly',
        license: 'Public Domain',
        attribution: 'Natural Earth',
        supported: true
      }
    );

    // GADM戦略
    this.register(
      'gadm-administrative-areas', 
      () => new GADMStrategy(),
      {
        id: 'gadm-administrative-areas',
        name: 'GADM',
        description: 'Database of Global Administrative Areas',
        category: 'administrative',
        dataTypes: ['countries', 'states', 'counties', 'municipalities'],
        coverageLevel: 'global',
        updateFrequency: 'yearly',
        license: 'Free for non-commercial use',
        attribution: 'GADM',
        supported: true
      }
    );

    // OpenStreetMap戦略
    this.register(
      'openstreetmap-overpass',
      () => new OpenStreetMapStrategy(),
      {
        id: 'openstreetmap-overpass',
        name: 'OpenStreetMap',
        description: 'Crowdsourced geographic data via Overpass API',
        category: 'general',
        dataTypes: ['administrative', 'natural', 'infrastructure', 'poi'],
        coverageLevel: 'global',
        updateFrequency: 'realtime',
        license: 'Open Database License (ODbL)',
        attribution: 'OpenStreetMap contributors',
        supported: true
      }
    );

    // GeoBoundaries戦略
    this.register(
      'geoboundaries-admin-areas',
      () => new GeoBoundariesStrategy(),
      {
        id: 'geoboundaries-admin-areas',
        name: 'GeoBoundaries',
        description: 'Open, research-ready administrative boundaries',
        category: 'administrative',
        dataTypes: ['administrative-boundaries'],
        coverageLevel: 'global',
        updateFrequency: 'yearly',
        license: 'Various open licenses',
        attribution: 'GeoBoundaries',
        supported: true
      }
    );
  }

  /**
   * 戦略を登録
   */
  register(
    id: DataSourceStrategyId,
    factory: () => DataSourceStrategy,
    info: DataSourceInfo
  ): void {
    this.strategies.set(id, factory);
    this.strategyInfo.set(id, info);
  }

  /**
   * 戦略の登録を解除
   */
  unregister(id: DataSourceStrategyId): void {
    this.strategies.delete(id);
    this.strategyInfo.delete(id);
  }

  /**
   * 戦略を作成
   */
  create(id: DataSourceStrategyId): DataSourceStrategy {
    const factory = this.strategies.get(id);
    if (!factory) {
      throw new Error(`Unknown data source strategy: ${id}`);
    }
    return factory();
  }

  /**
   * 利用可能な戦略IDを取得
   */
  getAvailableStrategies(): DataSourceStrategyId[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * サポートされている戦略IDを取得
   */
  getSupportedStrategies(): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => info.supported)
      .map(([id, _]) => id);
  }

  /**
   * 戦略情報を取得
   */
  getStrategyInfo(id: DataSourceStrategyId): DataSourceInfo | undefined {
    return this.strategyInfo.get(id);
  }

  /**
   * すべての戦略情報を取得
   */
  getAllStrategyInfo(): DataSourceInfo[] {
    return Array.from(this.strategyInfo.values());
  }

  /**
   * カテゴリ別に戦略を取得
   */
  getStrategiesByCategory(category: DataSourceInfo['category']): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => info.category === category && info.supported)
      .map(([id, _]) => id);
  }

  /**
   * カバレッジレベル別に戦略を取得
   */
  getStrategiesByCoverageLevel(level: DataSourceInfo['coverageLevel']): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => info.coverageLevel === level && info.supported)
      .map(([id, _]) => id);
  }

  /**
   * データタイプ別に戦略を検索
   */
  findStrategiesByDataType(dataType: string): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => 
        info.supported && info.dataTypes.some(type => 
          type.toLowerCase().includes(dataType.toLowerCase())
        )
      )
      .map(([id, _]) => id);
  }

  /**
   * 戦略が存在するかチェック
   */
  hasStrategy(id: DataSourceStrategyId): boolean {
    return this.strategies.has(id);
  }

  /**
   * 戦略がサポートされているかチェック
   */
  isStrategySupported(id: DataSourceStrategyId): boolean {
    const info = this.strategyInfo.get(id);
    return info?.supported || false;
  }

  /**
   * 戦略のヘルスチェック
   */
  async healthCheck(id: DataSourceStrategyId): Promise<boolean> {
    try {
      const strategy = this.create(id);
      if (strategy.healthCheck) {
        return await strategy.healthCheck();
      }
      return true;
    } catch (error) {
      console.error(`Health check failed for strategy ${id}:`, error);
      return false;
    }
  }

  /**
   * 全戦略のヘルスチェック
   */
  async healthCheckAll(): Promise<Map<DataSourceStrategyId, boolean>> {
    const results = new Map<DataSourceStrategyId, boolean>();
    const strategies = this.getSupportedStrategies();

    await Promise.allSettled(
      strategies.map(async (id) => {
        const isHealthy = await this.healthCheck(id);
        results.set(id, isHealthy);
      })
    );

    return results;
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): {
    total: number;
    supported: number;
    byCategory: Record<string, number>;
    byCoverageLevel: Record<string, number>;
  } {
    const allInfo = this.getAllStrategyInfo();
    const supported = allInfo.filter(info => info.supported);

    const byCategory: Record<string, number> = {};
    const byCoverageLevel: Record<string, number> = {};

    for (const info of supported) {
      byCategory[info.category] = (byCategory[info.category] || 0) + 1;
      byCoverageLevel[info.coverageLevel] = (byCoverageLevel[info.coverageLevel] || 0) + 1;
    }

    return {
      total: allInfo.length,
      supported: supported.length,
      byCategory,
      byCoverageLevel
    };
  }

  /**
   * 推奨戦略を取得（用途に応じて）
   */
  getRecommendedStrategy(purpose: 'administrative' | 'natural' | 'realtime' | 'research'): DataSourceStrategyId | null {
    const strategies = this.getSupportedStrategies();

    switch (purpose) {
      case 'administrative':
        // 行政区域データには精度の高いGADMまたはGeoBoundariesを推奨
        return strategies.find(id => ['gadm-administrative-areas', 'geoboundaries-admin-areas'].includes(id)) || null;
      
      case 'natural':
        // 自然地理データにはNatural Earthを推奨
        return strategies.find(id => id === 'natural-earth-shapes') || null;
      
      case 'realtime':
        // リアルタイムデータにはOpenStreetMapを推奨
        return strategies.find(id => id === 'openstreetmap-overpass') || null;
      
      case 'research':
        // 研究用途にはGeoBoundariesを推奨
        return strategies.find(id => id === 'geoboundaries-admin-areas') || null;
      
      default:
        return strategies[0] || null;
    }
  }
}

/**
 * デフォルトファクトリーインスタンス
 */
export const defaultDataSourceFactory = new DataSourceStrategyFactory();