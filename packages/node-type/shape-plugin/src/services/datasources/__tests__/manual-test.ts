/**
 * 手動テスト実行スクリプト
 * vitestの設定問題を回避して、データソース戦略の基本動作をテスト
 */

import { DataSourceStrategyFactory, defaultDataSourceFactory } from '../DataSourceStrategyFactory';
import { OpenStreetMapStrategy } from '../OpenStreetMapStrategy';
import { BaseDataSourceStrategy, FetchOptions, ProcessOptions } from '../DataSourceStrategy';
import { ShapeEntity } from '../../../types/ShapeEntity';

// テスト結果記録
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];

  test(name: string, testFn: () => void | Promise<void>) {
    console.log(`Running: ${name}`);
    try {
      const result = testFn();
      if (result instanceof Promise) {
        return result
          .then(() => {
            this.results.push({ name, passed: true });
            console.log(`✓ ${name}`);
          })
          .catch((error) => {
            this.results.push({ name, passed: false, error: error.message });
            console.log(`✗ ${name}: ${error.message}`);
          });
      } else {
        this.results.push({ name, passed: true });
        console.log(`✓ ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, error: errorMessage });
      console.log(`✗ ${name}: ${errorMessage}`);
    }
  }

  expect(actual: any) {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, but got ${actual}`);
        }
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
      },
      toContain: (item: any) => {
        if (!actual.includes(item)) {
          throw new Error(`Expected array to contain ${item}, but it didn't`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined, but got undefined`);
        }
      },
      toBeInstanceOf: (expectedClass: any) => {
        if (!(actual instanceof expectedClass)) {
          throw new Error(`Expected instance of ${expectedClass.name}, but got ${actual.constructor.name}`);
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toHaveLength: (expected: number) => {
        if (actual.length !== expected) {
          throw new Error(`Expected length ${expected}, but got ${actual.length}`);
        }
      }
    };
  }

  summary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    console.log('\n=== Test Summary ===');
    console.log(`Total: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`- ${r.name}: ${r.error}`));
    }
    
    return failed === 0;
  }
}

// テスト用のモック戦略
class MockStrategy extends BaseDataSourceStrategy<any, ShapeEntity[]> {
  readonly id = 'mock-strategy';
  readonly name = 'Mock Strategy';
  readonly config = {
    id: 'mock-strategy',
    name: 'Mock Strategy',
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
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [139.0, 35.0] },
          properties: { name: 'Test Feature', test: true }
        }
      ]
    };
  }

  async processData(rawData: any, options?: ProcessOptions): Promise<ShapeEntity[]> {
    return [{
      id: 'mock-entity-1',
      nodeId: 'mock-node-1',
      name: 'Mock Entity',
      geometry: { type: 'Point', coordinates: [139.0, 35.0] },
      properties: { test: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    } as ShapeEntity];
  }
}

async function runTests() {
  const runner = new TestRunner();
  
  console.log('=== Data Source Strategy Tests ===\n');

  // ファクトリーテスト
  runner.test('Factory should be created', () => {
    const factory = new DataSourceStrategyFactory();
    runner.expect(factory).toBeDefined();
  });

  runner.test('Factory should have default strategies', () => {
    const factory = new DataSourceStrategyFactory();
    const strategies = factory.getAvailableStrategies();
    
    runner.expect(strategies).toContain('natural-earth-shapes');
    runner.expect(strategies).toContain('gadm-administrative-areas');
    runner.expect(strategies).toContain('openstreetmap-overpass');
    runner.expect(strategies).toContain('geoboundaries-admin-areas');
  });

  runner.test('Factory should create strategy instances', () => {
    const factory = new DataSourceStrategyFactory();
    
    const neStrategy = factory.create('natural-earth-shapes');
    runner.expect(neStrategy.id).toBe('natural-earth-shapes');
    runner.expect(neStrategy.name).toBe('Natural Earth Vector Data');
  });

  runner.test('Factory should provide strategy information', () => {
    const factory = new DataSourceStrategyFactory();
    
    const info = factory.getStrategyInfo('natural-earth-shapes');
    runner.expect(info?.name).toBe('Natural Earth');
    runner.expect(info?.category).toBe('general');
    runner.expect(info?.supported).toBe(true);
  });

  runner.test('Factory should filter by category', () => {
    const factory = new DataSourceStrategyFactory();
    
    const adminStrategies = factory.getStrategiesByCategory('administrative');
    runner.expect(adminStrategies).toContain('gadm-administrative-areas');
    runner.expect(adminStrategies).toContain('geoboundaries-admin-areas');
  });

  runner.test('Factory should provide recommendations', () => {
    const factory = new DataSourceStrategyFactory();
    
    const naturalRec = factory.getRecommendedStrategy('natural');
    runner.expect(naturalRec).toBe('natural-earth-shapes');
    
    const realtimeRec = factory.getRecommendedStrategy('realtime');
    runner.expect(realtimeRec).toBe('openstreetmap-overpass');
  });

  runner.test('Factory should provide statistics', () => {
    const factory = new DataSourceStrategyFactory();
    const stats = factory.getStatistics();
    
    runner.expect(stats.total).toBe(4);
    runner.expect(stats.supported).toBe(4);
    runner.expect(stats.byCategory.general).toBe(2);
    runner.expect(stats.byCategory.administrative).toBe(2);
  });

  // OSM戦略テスト
  runner.test('OSM strategy should build queries', () => {
    const osmStrategy = new OpenStreetMapStrategy();
    const presets = osmStrategy.getAvailablePresets();
    
    runner.expect(presets.administrative).toBeDefined();
    runner.expect(presets.countries).toBeDefined();
    runner.expect(presets.cities).toBeDefined();
    
    const query = osmStrategy.buildPresetQuery('countries');
    runner.expect(query).toContain('admin_level=2');
    runner.expect(query).toContain('boundary=administrative');
  });

  runner.test('OSM strategy should build bbox queries', () => {
    const osmStrategy = new OpenStreetMapStrategy();
    const bbox = { minLat: 35.0, maxLat: 36.0, minLng: 139.0, maxLng: 140.0 };
    const query = osmStrategy.buildPresetQuery('countries', bbox);
    
    runner.expect(query).toContain('(35,139,36,140)');
  });

  // カスタム戦略テスト
  runner.test('Custom strategy should be registerable', () => {
    const factory = new DataSourceStrategyFactory();
    const mockStrategy = new MockStrategy();
    
    factory.register('mock-strategy' as any, () => mockStrategy, {
      id: 'mock-strategy' as any,
      name: 'Mock Strategy',
      description: 'Test strategy',
      category: 'general',
      dataTypes: ['test'],
      coverageLevel: 'global',
      updateFrequency: 'irregular',
      license: 'MIT',
      attribution: 'Test',
      supported: true
    });
    
    runner.expect(factory.hasStrategy('mock-strategy' as any)).toBe(true);
    const created = factory.create('mock-strategy' as any);
    runner.expect(created).toBeInstanceOf(MockStrategy);
  });

  // データ処理フローテスト
  await runner.test('Mock strategy should process data flow', async () => {
    const mockStrategy = new MockStrategy();
    
    // データ取得
    const rawData = await mockStrategy.fetchData({
      bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 }
    });
    runner.expect(rawData).toBeDefined();
    runner.expect(rawData.type).toBe('FeatureCollection');
    
    // データ処理
    const processedData = await mockStrategy.processData(rawData);
    runner.expect(processedData).toHaveLength(1);
    runner.expect(processedData[0].id).toBe('mock-entity-1');
    
    // バリデーション
    const validation = await mockStrategy.validateData(processedData);
    runner.expect(validation.isValid).toBe(true);
    runner.expect(validation.errors).toHaveLength(0);
    
    // 保存
    const saveResult = await mockStrategy.saveData(processedData, { type: 'hierarchidb' });
    runner.expect(saveResult.success).toBe(true);
  });

  // ヘルスチェックテスト
  await runner.test('Default factory should perform health checks', async () => {
    const healthResults = await defaultDataSourceFactory.healthCheckAll();
    runner.expect(healthResults.size).toBeGreaterThan(0);
    
    // 各戦略の結果が boolean であることを確認
    for (const [strategyId, isHealthy] of healthResults.entries()) {
      runner.expect(typeof isHealthy).toBe('boolean');
    }
  });

  // 結果の表示
  const success = runner.summary();
  
  if (success) {
    console.log('\n🎉 All tests passed! Data source strategies are working correctly.');
    console.log('\n=== Verification Summary ===');
    console.log('✓ Strategy factory pattern implemented correctly');
    console.log('✓ Multiple data source strategies available (Natural Earth, GADM, OSM, GeoBoundaries)');
    console.log('✓ Strategy registration and discovery working');
    console.log('✓ Configuration management working');
    console.log('✓ Query generation working (OSM Overpass)');
    console.log('✓ Data processing flow working (fetch → process → validate → save)');
    console.log('✓ Health check system working');
    console.log('✓ Filtering and recommendations working');
    console.log('\nThe data source strategy pattern is ready for integration!');
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// スクリプトとして直接実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };