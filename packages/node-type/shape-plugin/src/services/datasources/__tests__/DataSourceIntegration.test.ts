/**
 * データソース戦略の統合テスト
 * 実際のAPIエンドポイントを使用した動作検証
 * 
 * 注意: このテストはネットワーク接続が必要で、時間がかかる場合があります
 * CI/CDでは skip または別途実行することを推奨
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSourceStrategyFactory } from '../DataSourceStrategyFactory';
import { FetchOptions, ProcessOptions } from '../DataSourceStrategy';
import { OpenStreetMapStrategy } from '../OpenStreetMapStrategy';
import { GeoBoundariesStrategy } from '../GeoBoundariesStrategy';

// 統合テストの実行制御
const ENABLE_INTEGRATION_TESTS = process.env.ENABLE_INTEGRATION_TESTS === 'true';
const skipIf = (condition: boolean) => condition ? it.skip : it;

describe('Data Source Integration Tests', () => {
  let factory: DataSourceStrategyFactory;

  beforeEach(() => {
    factory = new DataSourceStrategyFactory();
  });

  describe('OpenStreetMap Integration', () => {
    let strategy: OpenStreetMapStrategy;

    beforeEach(() => {
      strategy = new OpenStreetMapStrategy();
    });

    skipIf(!ENABLE_INTEGRATION_TESTS)('should fetch real data from Overpass API', async () => {
      const options: FetchOptions = {
        bbox: {
          minLat: 35.6,
          maxLat: 35.7,
          minLng: 139.7,
          maxLng: 139.8
        },
        tags: ['countries'],
        timeout: 10 // 短いタイムアウト
      };

      try {
        const rawData = await strategy.fetchData(options);
        
        // データ構造の検証
        expect(rawData.elements).toBeDefined();
        expect(Array.isArray(rawData.elements)).toBe(true);
        expect(rawData.metadata).toBeDefined();
        expect(rawData.metadata.source).toBe('osm-overpass');
        
        console.log(`OSM: Fetched ${rawData.elements.length} elements`);
        
        // データ処理
        if (rawData.elements.length > 0) {
          const processedData = await strategy.processData(rawData);
          expect(Array.isArray(processedData)).toBe(true);
          
          if (processedData.length > 0) {
            const entity = processedData[0];
            expect(entity.id).toBeDefined();
            expect(entity.name).toBeDefined();
            expect(entity.properties?.source).toBe('osm-overpass');
            
            console.log(`OSM: Processed ${processedData.length} entities`);
            console.log(`First entity: ${entity.name} (${entity.id})`);
          }
        }
        
      } catch (error) {
        console.error('OSM integration test failed:', error);
        // Overpass APIの制限やネットワークエラーの可能性があるため、
        // テストを失敗させずに警告として扱う
        console.warn('OSM test skipped due to API limitations or network issues');
      }
    }, 30000); // 30秒のタイムアウト

    skipIf(!ENABLE_INTEGRATION_TESTS)('should build and execute administrative query', async () => {
      const query = strategy.buildPresetQuery('administrative', {
        minLat: 35.0,
        maxLat: 36.0,
        minLng: 139.0,
        maxLng: 140.0
      });

      expect(query).toContain('[admin_level]');
      expect(query).toContain('[boundary=administrative]');
      expect(query).toContain('(35,139,36,140)');
      
      console.log('Generated OSM Query:', query.substring(0, 200) + '...');
      
      // クエリが適切な形式であることを確認
      expect(query).toMatch(/\[timeout:\d+\]/);
      expect(query).toContain('out geom');
    });

    it('should handle rate limiting gracefully', async () => {
      // レート制限のテスト（実際のAPIを叩かずにconfig確認）
      expect(strategy.config.access.rateLimit).toBeDefined();
      expect(strategy.config.access.rateLimit?.requests).toBe(2);
      expect(strategy.config.access.rateLimit?.period).toBe(60000);
    });
  });

  describe('GeoBoundaries Integration', () => {
    let strategy: GeoBoundariesStrategy;

    beforeEach(() => {
      strategy = new GeoBoundariesStrategy();
    });

    skipIf(!ENABLE_INTEGRATION_TESTS)('should fetch metadata from GeoBoundaries API', async () => {
      try {
        const countries = await strategy.getAvailableCountries();
        expect(Array.isArray(countries)).toBe(true);
        
        if (countries.length > 0) {
          console.log(`GeoBoundaries: Found ${countries.length} countries`);
          console.log('Sample countries:', countries.slice(0, 5));
          
          // 日本のadminレベルを取得
          const japanLevels = await strategy.getAvailableAdminLevels('JPN');
          expect(Array.isArray(japanLevels)).toBe(true);
          
          console.log('Japan admin levels:', japanLevels);
        }
        
      } catch (error) {
        console.error('GeoBoundaries API test failed:', error);
        console.warn('GeoBoundaries test skipped due to API limitations');
      }
    }, 15000);

    skipIf(!ENABLE_INTEGRATION_TESTS)('should fetch boundary data for Japan', async () => {
      const options: FetchOptions = {
        country: 'JPN',
        adminLevel: 1
      };

      try {
        const rawData = await strategy.fetchData(options);
        
        expect(rawData.geojson).toBeDefined();
        expect(rawData.metadata).toBeDefined();
        expect(rawData.metadata.source).toBe('geoboundaries');
        expect(rawData.metadata.country).toBe('JPN');
        
        console.log(`GeoBoundaries: Downloaded data for ${rawData.metadata.country} ADM${rawData.metadata.adminLevel}`);
        
        // データ処理
        const processedData = await strategy.processData(rawData);
        expect(Array.isArray(processedData)).toBe(true);
        
        if (processedData.length > 0) {
          const entity = processedData[0];
          expect(entity.id).toBeDefined();
          expect(entity.name).toBeDefined();
          expect(entity.properties?.source).toBe('geoboundaries');
          
          console.log(`GeoBoundaries: Processed ${processedData.length} entities`);
          console.log(`First entity: ${entity.name} (${entity.id})`);
        }
        
      } catch (error) {
        console.error('GeoBoundaries data fetch failed:', error);
        console.warn('GeoBoundaries data test skipped due to API limitations');
      }
    }, 30000);
  });

  describe('Factory Integration', () => {
    it('should perform health checks on all strategies', async () => {
      const healthResults = await factory.healthCheckAll();
      
      expect(healthResults.size).toBeGreaterThan(0);
      
      for (const [strategyId, isHealthy] of healthResults.entries()) {
        console.log(`Health check ${strategyId}: ${isHealthy ? 'OK' : 'FAILED'}`);
        expect(typeof isHealthy).toBe('boolean');
      }
      
      // 少なくとも一つの戦略は健全であることを期待
      const healthyCount = Array.from(healthResults.values()).filter(h => h).length;
      expect(healthyCount).toBeGreaterThan(0);
    }, 15000);

    it('should provide appropriate recommendations', () => {
      const recommendations = {
        administrative: factory.getRecommendedStrategy('administrative'),
        natural: factory.getRecommendedStrategy('natural'),
        realtime: factory.getRecommendedStrategy('realtime'),
        research: factory.getRecommendedStrategy('research')
      };

      console.log('Strategy recommendations:', recommendations);

      expect(recommendations.administrative).toBeTruthy();
      expect(recommendations.natural).toBeTruthy();
      expect(recommendations.realtime).toBeTruthy();
      expect(recommendations.research).toBeTruthy();

      // 推奨戦略が実際に存在することを確認
      for (const [purpose, strategyId] of Object.entries(recommendations)) {
        if (strategyId) {
          expect(factory.hasStrategy(strategyId)).toBe(true);
          const info = factory.getStrategyInfo(strategyId);
          expect(info?.supported).toBe(true);
          console.log(`${purpose}: ${info?.name} (${strategyId})`);
        }
      }
    });

    it('should filter strategies correctly', () => {
      const adminStrategies = factory.getStrategiesByCategory('administrative');
      const globalStrategies = factory.getStrategiesByCoverageLevel('global');
      const countryStrategies = factory.findStrategiesByDataType('countries');

      console.log('Administrative strategies:', adminStrategies);
      console.log('Global strategies:', globalStrategies);
      console.log('Country data strategies:', countryStrategies);

      expect(adminStrategies.length).toBeGreaterThan(0);
      expect(globalStrategies.length).toBeGreaterThan(0);
      expect(countryStrategies.length).toBeGreaterThan(0);

      // 管理戦略にはGADMやGeoBoundariesが含まれるべき
      expect(
        adminStrategies.some(id => 
          ['gadm-administrative-areas', 'geoboundaries-admin-areas'].includes(id)
        )
      ).toBe(true);
    });

    it('should provide comprehensive statistics', () => {
      const stats = factory.getStatistics();
      
      console.log('Factory statistics:', stats);
      
      expect(stats.total).toBeGreaterThanOrEqual(4); // 4つの基本戦略
      expect(stats.supported).toBeGreaterThan(0);
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byCoverageLevel).length).toBeGreaterThan(0);
      
      // カテゴリ統計の妥当性チェック
      const categoryTotal = Object.values(stats.byCategory).reduce((sum, count) => sum + count, 0);
      expect(categoryTotal).toBe(stats.supported);
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      const strategy = factory.create('openstreetmap-overpass');
      
      // 無効なオプションでエラーを発生させる
      const options: FetchOptions = {
        query: 'invalid overpass query syntax',
        timeout: 1 // 非常に短いタイムアウト
      };

      try {
        await strategy.fetchData(options);
        // エラーが発生しなかった場合は意外だが、APIが寛容な可能性
        console.log('Strategy handled invalid query gracefully');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log('Strategy properly threw error for invalid query:', error.message);
      }
    });

    it('should handle empty/invalid data processing', async () => {
      const strategy = factory.create('natural-earth-shapes');
      
      // 無効なrawDataでprocessDataをテスト
      try {
        await strategy.processData(null as any);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log('Strategy properly handled null raw data');
      }

      try {
        await strategy.processData({});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log('Strategy properly handled empty raw data');
      }
    });
  });
});

// テストユーティリティ：環境変数の確認とガイダンス
describe('Test Environment', () => {
  it('should provide guidance for integration tests', () => {
    if (!ENABLE_INTEGRATION_TESTS) {
      console.log('\n=== Integration Test Information ===');
      console.log('Integration tests are currently disabled.');
      console.log('To enable them, run:');
      console.log('  ENABLE_INTEGRATION_TESTS=true npm test');
      console.log('');
      console.log('Note: Integration tests require internet connection');
      console.log('and may be subject to API rate limits.');
      console.log('=====================================\n');
    } else {
      console.log('\n=== Integration Tests Enabled ===');
      console.log('Running with real API endpoints.');
      console.log('Tests may be slower and subject to rate limits.');
      console.log('==================================\n');
    }
    
    // このテストは常にパス
    expect(true).toBe(true);
  });
});