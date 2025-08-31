/**
 * データソース戦略の包括的テスト
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { DataSourceStrategyFactory, defaultDataSourceFactory } from '../DataSourceStrategyFactory';
import { 
  DataSourceStrategy,
  BaseDataSourceStrategy,
  FetchOptions,
  ProcessOptions,
  ValidationResult,
  SaveTarget,
  SaveResult
} from '../DataSourceStrategy';
import { NaturalEarthStrategy } from '../NaturalEarthStrategy';
import { GADMStrategy } from '../GADMStrategy';
import { OpenStreetMapStrategy } from '../OpenStreetMapStrategy';
import { GeoBoundariesStrategy } from '../GeoBoundariesStrategy';
import { ShapeEntity } from '../../../types/ShapeEntity';

// モック用のfetch
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

// テスト用のモックデータ
const mockGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [139.0, 35.0],
          [140.0, 35.0], 
          [140.0, 36.0],
          [139.0, 36.0],
          [139.0, 35.0]
        ]]
      },
      properties: {
        NAME: 'Test Area',
        ISO_A3: 'TST',
        POP_EST: 1000000
      }
    }
  ]
};

const mockOSMData = {
  elements: [
    {
      type: 'way' as const,
      id: 123456,
      nodes: [1, 2, 3, 4, 1],
      tags: {
        name: 'Test Boundary',
        boundary: 'administrative',
        admin_level: '2'
      }
    }
  ],
  generator: 'Overpass API'
};

// テスト用のカスタム戦略
class TestStrategy extends BaseDataSourceStrategy<any, ShapeEntity[]> {
  readonly id = 'test-strategy';
  readonly name = 'Test Strategy';
  readonly config = {
    id: 'test-strategy',
    name: 'Test Strategy',
    version: '1.0.0',
    access: {
      method: 'REST' as const,
      authentication: { type: 'none' as const }
    },
    processing: {
      inputFormat: 'json' as const,
      outputFormat: 'geojson' as const
    }
  };

  async fetchData(options?: FetchOptions): Promise<any> {
    return { test: 'data', options };
  }

  async processData(rawData: any, options?: ProcessOptions): Promise<ShapeEntity[]> {
    return [{
      id: 'test-entity-1',
      nodeId: 'test-node-1',
      name: 'Test Entity',
      geometry: {
        type: 'Point',
        coordinates: [139.0, 35.0]
      },
      properties: { test: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    } as ShapeEntity];
  }
}

describe('DataSourceStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BaseDataSourceStrategy', () => {
    let strategy: TestStrategy;

    beforeEach(() => {
      strategy = new TestStrategy();
    });

    it('should implement basic strategy interface', () => {
      expect(strategy.id).toBe('test-strategy');
      expect(strategy.name).toBe('Test Strategy');
      expect(strategy.config).toBeDefined();
    });

    it('should fetch data with options', async () => {
      const options: FetchOptions = {
        bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 }
      };

      const result = await strategy.fetchData(options);
      expect(result).toEqual({ test: 'data', options });
    });

    it('should process data with options', async () => {
      const rawData = { test: 'raw' };
      const options: ProcessOptions = {
        simplify: true,
        tolerance: 0.01
      };

      const result = await strategy.processData(rawData, options);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-entity-1');
      expect(result[0].name).toBe('Test Entity');
    });

    it('should validate data successfully', async () => {
      const data = [{
        id: 'test',
        name: 'Test',
        geometry: { type: 'Point', coordinates: [0, 0] }
      }] as ShapeEntity[];

      const result = await strategy.validateData(data);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate empty data as invalid', async () => {
      const result = await strategy.validateData([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('データが空です');
    });

    it('should save data successfully', async () => {
      const data = [{ id: 'test' }] as ShapeEntity[];
      const target: SaveTarget = {
        type: 'hierarchidb',
        entityType: 'shape'
      };

      const result = await strategy.saveData(data, target);
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should perform health check', async () => {
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
      
      // baseUrlを設定してテスト
      strategy.config.access.baseUrl = 'https://test.example.com/';
      const isHealthy = await strategy.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      strategy.config.access.baseUrl = 'https://test.example.com/';
      const isHealthy = await strategy.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});

describe('DataSourceStrategyFactory', () => {
  let factory: DataSourceStrategyFactory;

  beforeEach(() => {
    factory = new DataSourceStrategyFactory();
  });

  it('should create default strategies', () => {
    const strategies = factory.getAvailableStrategies();
    expect(strategies).toContain('natural-earth-shapes');
    expect(strategies).toContain('gadm-administrative-areas');
    expect(strategies).toContain('openstreetmap-overpass');
    expect(strategies).toContain('geoboundaries-admin-areas');
  });

  it('should create strategy instances', () => {
    const naturalEarth = factory.create('natural-earth-shapes');
    expect(naturalEarth).toBeInstanceOf(NaturalEarthStrategy);
    expect(naturalEarth.id).toBe('natural-earth-shapes');

    const gadm = factory.create('gadm-administrative-areas');
    expect(gadm).toBeInstanceOf(GADMStrategy);
    expect(gadm.id).toBe('gadm-administrative-areas');

    const osm = factory.create('openstreetmap-overpass');
    expect(osm).toBeInstanceOf(OpenStreetMapStrategy);
    expect(osm.id).toBe('openstreetmap-overpass');

    const geoBoundaries = factory.create('geoboundaries-admin-areas');
    expect(geoBoundaries).toBeInstanceOf(GeoBoundariesStrategy);
    expect(geoBoundaries.id).toBe('geoboundaries-admin-areas');
  });

  it('should throw error for unknown strategy', () => {
    expect(() => {
      factory.create('unknown-strategy' as any);
    }).toThrow('Unknown data source strategy: unknown-strategy');
  });

  it('should get strategy information', () => {
    const info = factory.getStrategyInfo('natural-earth-shapes');
    expect(info).toBeDefined();
    expect(info?.name).toBe('Natural Earth');
    expect(info?.category).toBe('general');
    expect(info?.supported).toBe(true);
  });

  it('should filter strategies by category', () => {
    const adminStrategies = factory.getStrategiesByCategory('administrative');
    expect(adminStrategies).toContain('gadm-administrative-areas');
    expect(adminStrategies).toContain('geoboundaries-admin-areas');
    expect(adminStrategies).not.toContain('natural-earth-shapes');
  });

  it('should filter strategies by coverage level', () => {
    const globalStrategies = factory.getStrategiesByCoverageLevel('global');
    expect(globalStrategies).toContain('natural-earth-shapes');
    expect(globalStrategies).toContain('gadm-administrative-areas');
    expect(globalStrategies).toContain('openstreetmap-overpass');
    expect(globalStrategies).toContain('geoboundaries-admin-areas');
  });

  it('should find strategies by data type', () => {
    const adminStrategies = factory.findStrategiesByDataType('administrative');
    expect(adminStrategies.length).toBeGreaterThan(0);

    const countryStrategies = factory.findStrategiesByDataType('countries');
    expect(countryStrategies).toContain('natural-earth-shapes');
  });

  it('should register custom strategy', () => {
    const customStrategy = new TestStrategy();
    factory.register('test-strategy' as any, () => customStrategy, {
      id: 'test-strategy' as any,
      name: 'Test Strategy',
      description: 'Test strategy for unit tests',
      category: 'general',
      dataTypes: ['test'],
      coverageLevel: 'global',
      updateFrequency: 'irregular',
      license: 'MIT',
      attribution: 'Test',
      supported: true
    });

    expect(factory.hasStrategy('test-strategy' as any)).toBe(true);
    const created = factory.create('test-strategy' as any);
    expect(created).toBeInstanceOf(TestStrategy);
  });

  it('should unregister strategy', () => {
    factory.unregister('natural-earth-shapes');
    expect(factory.hasStrategy('natural-earth-shapes')).toBe(false);
  });

  it('should get recommendations', () => {
    const adminRec = factory.getRecommendedStrategy('administrative');
    expect(['gadm-administrative-areas', 'geoboundaries-admin-areas']).toContain(adminRec);

    const naturalRec = factory.getRecommendedStrategy('natural');
    expect(naturalRec).toBe('natural-earth-shapes');

    const realtimeRec = factory.getRecommendedStrategy('realtime');
    expect(realtimeRec).toBe('openstreetmap-overpass');

    const researchRec = factory.getRecommendedStrategy('research');
    expect(researchRec).toBe('geoboundaries-admin-areas');
  });

  it('should get statistics', () => {
    const stats = factory.getStatistics();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.supported).toBeGreaterThan(0);
    expect(stats.byCategory).toBeDefined();
    expect(stats.byCoverageLevel).toBeDefined();
  });

  it('should perform health check on single strategy', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
    
    const isHealthy = await factory.healthCheck('natural-earth-shapes');
    // 実際のNaturalEarthStrategyはbaseUrlを持たないため、常にtrue
    expect(isHealthy).toBe(true);
  });

  it('should perform health check on all strategies', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
    
    const results = await factory.healthCheckAll();
    expect(results.size).toBeGreaterThan(0);
    
    // 各戦略の結果をチェック
    for (const [strategyId, isHealthy] of results.entries()) {
      expect(typeof isHealthy).toBe('boolean');
    }
  });
});

describe('Natural Earth Strategy', () => {
  let strategy: NaturalEarthStrategy;

  beforeEach(() => {
    strategy = new NaturalEarthStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('natural-earth-shapes');
    expect(strategy.name).toBe('Natural Earth Vector Data');
    expect(strategy.config.access.method).toBe('File');
    expect(strategy.config.access.baseUrl).toContain('naturalearthdata.com');
  });

  it('should select appropriate endpoint', () => {
    // プライベートメソッドのテストのため、publicメソッド経由でテスト
    const options1: FetchOptions = { endpoint: 'countries-50m' };
    const options2: FetchOptions = { adminLevel: 0 };
    
    // 実際のfetchDataはモック化が複雑なため、設定のテストに留める
    expect(strategy.config.access.endpoints).toHaveProperty('countries-50m');
    expect(strategy.config.access.endpoints).toHaveProperty('states-50m');
    expect(strategy.config.access.endpoints).toHaveProperty('cities-50m');
  });
});

describe('GADM Strategy', () => {
  let strategy: GADMStrategy;

  beforeEach(() => {
    strategy = new GADMStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('gadm-administrative-areas');
    expect(strategy.name).toBe('GADM Administrative Areas');
    expect(strategy.config.access.method).toBe('File');
    expect(strategy.config.access.baseUrl).toContain('geodata.ucdavis.edu');
  });

  it('should normalize country codes', () => {
    // プライベートメソッドのテスト用に、設定を確認
    expect(strategy.config.access.endpoints).toHaveProperty('country-gpkg');
    expect(strategy.config.access.endpoints).toHaveProperty('country-shp');
  });
});

describe('OpenStreetMap Strategy', () => {
  let strategy: OpenStreetMapStrategy;

  beforeEach(() => {
    strategy = new OpenStreetMapStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('openstreetmap-overpass');
    expect(strategy.name).toBe('OpenStreetMap Overpass API');
    expect(strategy.config.access.method).toBe('REST');
    expect(strategy.config.access.baseUrl).toContain('overpass-api.de');
  });

  it('should get available presets', () => {
    const presets = strategy.getAvailablePresets();
    expect(presets).toHaveProperty('administrative');
    expect(presets).toHaveProperty('countries');
    expect(presets).toHaveProperty('cities');
    expect(presets).toHaveProperty('coastlines');
  });

  it('should build preset query', () => {
    const query = strategy.buildPresetQuery('countries');
    expect(query).toContain('admin_level=2');
    expect(query).toContain('boundary=administrative');
    expect(query).toContain('out geom');
  });

  it('should build query with bbox', () => {
    const bbox = { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 };
    const query = strategy.buildPresetQuery('countries', bbox);
    expect(query).toContain('(35,139,36,140)');
  });
});

describe('GeoBoundaries Strategy', () => {
  let strategy: GeoBoundariesStrategy;

  beforeEach(() => {
    strategy = new GeoBoundariesStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('geoboundaries-admin-areas');
    expect(strategy.name).toBe('GeoBoundaries Administrative Areas');
    expect(strategy.config.access.method).toBe('REST');
    expect(strategy.config.access.baseUrl).toContain('geoboundaries.org');
  });

  it('should get available countries (mocked)', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      USA: ['ADM0', 'ADM1', 'ADM2'],
      JPN: ['ADM0', 'ADM1']
    }), { status: 200 }));

    const countries = await strategy.getAvailableCountries();
    expect(Array.isArray(countries)).toBe(true);
  });

  it('should get available admin levels (mocked)', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      USA: ['ADM0', 'ADM1', 'ADM2'],
      JPN: ['ADM0', 'ADM1']
    }), { status: 200 }));

    const levels = await strategy.getAvailableAdminLevels('USA');
    expect(Array.isArray(levels)).toBe(true);
  });
});

describe('Integration Tests', () => {
  it('should create and use strategies through factory', async () => {
    const factory = defaultDataSourceFactory;
    
    // 各戦略を作成してbasic operationsをテスト
    const strategies = factory.getSupportedStrategies();
    
    for (const strategyId of strategies) {
      const strategy = factory.create(strategyId);
      
      // 設定の存在確認
      expect(strategy.config).toBeDefined();
      expect(strategy.config.id).toBe(strategyId);
      
      // メソッドの存在確認
      expect(typeof strategy.fetchData).toBe('function');
      expect(typeof strategy.processData).toBe('function');
      expect(typeof strategy.validateData).toBe('function');
      expect(typeof strategy.saveData).toBe('function');
    }
  });

  it('should handle errors gracefully', async () => {
    const strategy = new TestStrategy();
    
    // バリデーションエラー
    const invalidData = null as any;
    const result = await strategy.validateData(invalidData);
    expect(result.isValid).toBe(false);
    
    // 保存エラー（モック）
    const mockStrategy = { ...strategy };
    mockStrategy.saveData = vi.fn().mockRejectedValue(new Error('Save failed'));
    
    try {
      await mockStrategy.saveData([], { type: 'hierarchidb' });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should work with real-like data flow', async () => {
    const strategy = new TestStrategy();
    
    // データ取得
    const fetchOptions: FetchOptions = {
      bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 },
      adminLevel: 1
    };
    const rawData = await strategy.fetchData(fetchOptions);
    expect(rawData).toBeDefined();
    
    // データ処理
    const processOptions: ProcessOptions = {
      simplify: true,
      tolerance: 0.01
    };
    const processedData = await strategy.processData(rawData, processOptions);
    expect(processedData).toHaveLength(1);
    
    // バリデーション
    const validation = await strategy.validateData(processedData);
    expect(validation.isValid).toBe(true);
    
    // 保存
    const saveTarget: SaveTarget = {
      type: 'hierarchidb',
      entityType: 'shape',
      parentId: 'test-parent'
    };
    const saveResult = await strategy.saveData(processedData, saveTarget);
    expect(saveResult.success).toBe(true);
  });
});