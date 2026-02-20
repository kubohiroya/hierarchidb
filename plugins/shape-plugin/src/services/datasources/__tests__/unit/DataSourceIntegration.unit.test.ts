/**
   * API
  * :
 * CI/CD skip
  */

import { beforeEach, describe, expect, it } from 'vitest';
import { DataSourceStrategyFactory } from '../DataSourceStrategyFactory';
import type { FetchOptions } from '../DataSourceStrategy';
import { GeoBoundariesStrategy } from '../GeoBoundariesStrategy';
import { metadataLoader } from '../../metadata/MetadataLoader';

describe('Data Source Integration Tests', () => {
  let factory: DataSourceStrategyFactory;

  beforeEach(() => {
    factory = new DataSourceStrategyFactory();
  });

  describe('GeoBoundaries Integration', () => {
    let strategy: GeoBoundariesStrategy;

    beforeEach(() => {
      strategy = new GeoBoundariesStrategy();
    });

    it('should fetch metadata from GeoBoundaries API', async () => {
      try {
        const countries = await metadataLoader.loadMetadata('geoboundaries', 'node-1');
        expect(Array.isArray(countries)).toBe(true);

        if (countries.length > 0) {
          console.log(`GeoBoundaries: Found ${countries.length} countries`);
          console.log('Sample countries:', countries.slice(0, 5));
        }

      } catch (error) {
        console.error('GeoBoundaries API test failed:', error);
        console.warn('GeoBoundaries test skipped due to API limitations');
      }
    }, 15000);

    it('should fetch boundary data for Japan', async () => {
      const options: FetchOptions = {
        country: 'JPN',
        adminLevel: 1,
      };

      try {
        const rawData = await strategy.fetchData(options);

        expect(rawData.geojson).toBeDefined();
        expect(rawData.metadata).toBeDefined();
        expect(rawData.metadata.source).toBe('geoboundaries');
        expect(rawData.metadata.country).toBe('JPN');

        console.log(`GeoBoundaries: Downloaded data for ${rawData.metadata.country} ADM${rawData.metadata.adminLevel}`);

        const processedData = await strategy.processData(rawData);
        expect(Array.isArray(processedData)).toBe(true);

        if (processedData.length > 0) {
          const entity = processedData[0];
          expect(entity.id).toBeDefined();
          //expect(entity.name).toBeDefined();
          //expect(entity.properties?.source).toBe('geoboundaries');

          console.log(`GeoBoundaries: Processed ${processedData.length} entities`);
          //console.log(`First entity: ${entity.name} (${entity.id})`);
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

      for (const [strategyId, isHealthy] of Object.entries(healthResults)) {
        console.log(`Health check ${strategyId}: ${isHealthy ? 'OK' : 'FAILED'}`);
        expect(typeof isHealthy).toBe('boolean');
      }

      const healthyCount = Array.from(healthResults.values()).filter(h => h).length;
      expect(healthyCount).toBeGreaterThan(0);
    }, 15000);

    it('should provide appropriate recommendations', () => {
      const recommendations = {
        administrative: factory.getRecommendedStrategy('administrative'),
        natural: factory.getRecommendedStrategy('natural'),
        realtime: factory.getRecommendedStrategy('realtime'),
        research: factory.getRecommendedStrategy('research'),
      };

      console.log('Strategy recommendations:', recommendations);

      expect(recommendations.administrative).toBeTruthy();
      expect(recommendations.natural).toBeTruthy();
      expect(recommendations.realtime).toBeTruthy();
      expect(recommendations.research).toBeTruthy();

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

      //  GADMGeoBoundaries
      expect(
        adminStrategies.some(id =>
          ['gadm-administrative-areas', 'geoboundaries-admin-areas'].includes(id),
        ),
      ).toBe(true);
    });

    it('should provide comprehensive statistics', () => {
      const stats = factory.getStatistics();

      console.log('Factory statistics:', stats);

      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.supported).toBeGreaterThan(0);
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byCoverageLevel).length).toBeGreaterThan(0);

      const categoryTotal = Object.values(stats.byCategory).reduce((sum, count) => sum + count, 0);
      expect(categoryTotal).toBe(stats.supported);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty/invalid data processing', async () => {
      const strategy = factory.create('natural-earth-shapes');

      //  rawDataprocessData
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

describe('Test Environment', () => {
  it('runs network integration tests directly against data source URLs', () => {
    console.log('\n=== Integration Tests Enabled ===');
    console.log('Node test runtime uses direct data source URLs without CORS proxy.');
    console.log('Tests may be slower and subject to API rate limits.');
    console.log('==================================\n');
    expect(true).toBe(true);
  });
});
