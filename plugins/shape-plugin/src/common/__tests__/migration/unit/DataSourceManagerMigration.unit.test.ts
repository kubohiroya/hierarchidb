/**
  * @file DataSourceManagerMigration.test.ts
 * @description ERIA-CartographDataSourceManager (TDD Red Phase)
   * - fetch-metadataDataSourceManager
 * - GeoBoundariesOpenStreetMap
 * -
   * - @hierarchidb/runtime-ui-datasource
 * - fetch-save-metadata
 * - DataSourceManager
  */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DataSourceName } from '@hierarchidb/ui-datasource';
import { DataSourceManager } from '@hierarchidb/runtime-ui-datasource';

describe('DataSourceManager Migration Tests', () => {
  let dataSourceManager: DataSourceManager;

  beforeEach(() => {
    //  Given: DataSourceManager
    dataSourceManager = new DataSourceManager();
  });

  describe('fetch-metadataとの統合テスト', () => {
    it('fetch-metadataから生成された実際のメタデータでDataSourceManagerが正常動作する', async () => {
      //  Given:
      const dataSource: DataSourceName = 'naturalearth';

      //  When:
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');

      //  Then:
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      expect(metadata.countryName).toBeDefined();
      expect(metadata.adminLevels).toBeDefined();
      expect(Array.isArray(metadata.adminLevels)).toBe(true);
      expect(metadata.adminLevels.length).toBeGreaterThan(0);
    });

    it('GADMデータソースのメタデータが正常に取得される', async () => {
      //  Given: GADM
      const dataSource: DataSourceName = 'gadm';

      //  When:
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');

      //  Then: GADM
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      expect(metadata.adminLevels).toBeDefined();
      expect(metadata.adminLevels.length).toBeGreaterThan(0);
    });
  });

  describe('新しいデータソース戦略テスト', () => {
    it('GeoBoundaries戦略が正常に実装される', async () => {
      //  Given: GeoBoundaries
      const dataSource: DataSourceName = 'geoboundaries';

      //  When: GeoBoundaries
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');

      //  Then: GeoBoundaries
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      //  GeoBoundaries
      expect(metadata.adminLevels).toBeDefined();
    });

    it('OpenStreetMap戦略が正常に実装される', async () => {
      //  Given: OpenStreetMap
      const dataSource: DataSourceName = 'openstreetmap';

      //  When: OpenStreetMap
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');

      //  Then: OpenStreetMap
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      //  OpenStreetMap
      expect(metadata.adminLevels).toBeDefined();
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('無効な国コードでエラーが適切にハンドリングされる', async () => {
      //  Given:
      const invalidCountryCode = 'XX';
      const dataSource: DataSourceName = 'naturalearth';

      //  When & Then:
      await expect(
        dataSourceManager.getCountryMetadata(dataSource, invalidCountryCode),
      ).rejects.toThrow('not found');
    });

    it('存在しないデータソースでエラーが発生する', async () => {
      //  Given:
      const invalidDataSource = 'nonexistent' as DataSourceName;

      //  When & Then:
      await expect(
        dataSourceManager.getCountryMetadata(invalidDataSource, 'JP'),
      ).rejects.toThrow('Data source nonexistent not found');
    });
  });

  describe('境界値テスト', () => {
    it('最大管理レベル数の処理が正常に動作する', async () => {
      //  Given: 5
      const dataSource: DataSourceName = 'gadm';
      const countryWithMaxLevels = 'USA';
      //  When:
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, countryWithMaxLevels);

      //  Then:
      expect(metadata.adminLevels).toBeDefined();
      expect(metadata.adminLevels.length).toBeGreaterThan(3);
      expect(metadata.adminLevels.length).toBeLessThanOrEqual(6);
    });
  });
});