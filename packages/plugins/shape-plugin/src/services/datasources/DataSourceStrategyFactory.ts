/**
   * DATA_SOURCE_STRATEGY_DESIGN.md
  */

import type { DataSourceStrategy } from './DataSourceStrategy.js';
import { NaturalEarthStrategy } from './NaturalEarthStrategy.js';
import { GADMStrategy } from './GADMStrategy.js';
import { OpenStreetMapStrategy } from './OpenStreetMapStrategy.js';
import { GeoBoundariesStrategy } from './GeoBoundariesStrategy.js';

export type DataSourceStrategyId =
  | 'natural-earth-shapes'
  | 'gadm-administrative-areas'
  | 'openstreetmap-overpass'
  | 'geoboundaries-admin-areas';

/**
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
    */
export class DataSourceStrategyFactory {
  private strategies = new Map<DataSourceStrategyId, () => DataSourceStrategy>();
  private strategyInfo = new Map<DataSourceStrategyId, DataSourceInfo>();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
            */
  private registerDefaultStrategies(): void {
    //  Natural Earth
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
        supported: true,
      },
    );

    //  GADM
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
        supported: true,
      },
    );

    //  OpenStreetMap
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
        supported: true,
      },
    );

    //  GeoBoundaries
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
        supported: true,
      },
    );
  }

  /**
            */
  register(
    id: DataSourceStrategyId,
    factory: () => DataSourceStrategy,
    info: DataSourceInfo,
  ): void {
    this.strategies.set(id, factory);
    this.strategyInfo.set(id, info);
  }

  /**
            */
  unregister(id: DataSourceStrategyId): void {
    this.strategies.delete(id);
    this.strategyInfo.delete(id);
  }

  /**
            */
  create(id: DataSourceStrategyId): DataSourceStrategy {
    const factory = this.strategies.get(id);
    if (!factory) {
      throw new Error(`Unknown data source strategy: ${id}`);
    }
    return factory();
  }

  /**
      * ID
      */
  getAvailableStrategies(): DataSourceStrategyId[] {
    return Array.from(this.strategies.keys());
  }

  /**
      * ID
      */
  getSupportedStrategies(): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => info.supported)
      .map(([id, _]) => id);
  }

  /**
            */
  getStrategyInfo(id: DataSourceStrategyId): DataSourceInfo | undefined {
    return this.strategyInfo.get(id);
  }

  /**
            */
  getAllStrategyInfo(): DataSourceInfo[] {
    return Array.from(this.strategyInfo.values());
  }

  /**
            */
  getStrategiesByCategory(category: DataSourceInfo['category']): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => info.category === category && info.supported)
      .map(([id, _]) => id);
  }

  /**
            */
  getStrategiesByCoverageLevel(level: DataSourceInfo['coverageLevel']): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) => info.coverageLevel === level && info.supported)
      .map(([id, _]) => id);
  }

  /**
            */
  findStrategiesByDataType(dataType: string): DataSourceStrategyId[] {
    return Array.from(this.strategyInfo.entries())
      .filter(([_, info]) =>
          info.supported && info.dataTypes.some(type =>
            type.toLowerCase().includes(dataType.toLowerCase()),
          ),
      )
      .map(([id, _]) => id);
  }

  /**
            */
  hasStrategy(id: DataSourceStrategyId): boolean {
    return this.strategies.has(id);
  }

  /**
            */
  isStrategySupported(id: DataSourceStrategyId): boolean {
    const info = this.strategyInfo.get(id);
    return info?.supported || false;
  }

  /**
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
            */
  async healthCheckAll(): Promise<Map<DataSourceStrategyId, boolean>> {
    const results = new Map<DataSourceStrategyId, boolean>();
    const strategies = this.getSupportedStrategies();

    await Promise.allSettled(
      strategies.map(async (id) => {
        const isHealthy = await this.healthCheck(id);
        results.set(id, isHealthy);
      }),
    );

    return results;
  }

  /**
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
      byCoverageLevel,
    };
  }

  /**
            */
  getRecommendedStrategy(purpose: 'administrative' | 'natural' | 'realtime' | 'research'): DataSourceStrategyId | null {
    const strategies = this.getSupportedStrategies();

    switch (purpose) {
      case 'administrative':
        //  GADMGeoBoundaries
        return strategies.find(id => ['gadm-administrative-areas', 'geoboundaries-admin-areas'].includes(id)) || null;

      case 'natural':
        //  Natural Earth
        return strategies.find(id => id === 'natural-earth-shapes') || null;

      case 'realtime':
        //  OpenStreetMap
        return strategies.find(id => id === 'openstreetmap-overpass') || null;

      case 'research':
        //  GeoBoundaries
        return strategies.find(id => id === 'geoboundaries-admin-areas') || null;

      default:
        return strategies[0] || null;
    }
  }
}

/**
    */
export const defaultDataSourceFactory = new DataSourceStrategyFactory();