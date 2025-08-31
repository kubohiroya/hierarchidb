/**
 * @file DataSourceManagerMigration.test.ts
 * @description ERIA-Cartograph移植に向けたDataSourceManager統合テスト (TDD Red Phase)
 * 
 * テスト目的：
 * - fetch-metadataから生成された実際のメタデータでDataSourceManagerが正常動作することを検証
 * - GeoBoundaries、OpenStreetMap戦略が期待通りに動作することを確認
 * - 無効な国コード処理のエラーハンドリングを検証
 * 
 * 前提条件：
 * - @hierarchidb/runtime-ui-datasourceパッケージの統合が完了
 * - fetch-metadataパッケージからのメタデータ読み込み機能が実装済み
 * - DataSourceManagerの各戦略クラスが実装済み
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSourceManager } from '@hierarchidb/runtime-ui-datasource';
import type { DataSourceName } from '@hierarchidb/runtime-ui-datasource';

describe('DataSourceManager Migration Tests', () => {
  let dataSourceManager: DataSourceManager;

  beforeEach(() => {
    // Given: DataSourceManagerのインスタンスを作成
    dataSourceManager = new DataSourceManager();
  });

  describe('fetch-metadataとの統合テスト', () => {
    it('fetch-metadataから生成された実際のメタデータでDataSourceManagerが正常動作する', async () => {
      // Given: 実際のメタデータが存在する前提
      const dataSource: DataSourceName = 'naturalearth';
      
      // When: メタデータを取得しようとする
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');
      
      // Then: メタデータが正常に取得される
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      expect(metadata.countryName).toBeDefined();
      expect(metadata.adminLevels).toBeDefined();
      expect(Array.isArray(metadata.adminLevels)).toBe(true);
      expect(metadata.adminLevels.length).toBeGreaterThan(0);
    });

    it('GADMデータソースのメタデータが正常に取得される', async () => {
      // Given: GADMデータソースを指定
      const dataSource: DataSourceName = 'gadm';
      
      // When: メタデータを取得
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');
      
      // Then: GADM固有のメタデータ構造が返される
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      expect(metadata.adminLevels).toBeDefined();
      expect(metadata.adminLevels.length).toBeGreaterThan(0);
    });
  });

  describe('新しいデータソース戦略テスト', () => {
    it('GeoBoundaries戦略が正常に実装される', async () => {
      // Given: GeoBoundariesデータソース
      const dataSource: DataSourceName = 'geoboundaries';
      
      // When: GeoBoundaries戦略を使用してメタデータ取得を試行
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');
      
      // Then: GeoBoundaries固有のメタデータが返される
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      // GeoBoundariesは管理レベル情報を持つはず
      expect(metadata.adminLevels).toBeDefined();
    });

    it('OpenStreetMap戦略が正常に実装される', async () => {
      // Given: OpenStreetMapデータソース
      const dataSource: DataSourceName = 'openstreetmap';
      
      // When: OpenStreetMap戦略を使用してメタデータ取得を試行
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, 'JP');
      
      // Then: OpenStreetMap固有のメタデータが返される
      expect(metadata).toBeDefined();
      expect(metadata.countryCode).toBe('JP');
      // OpenStreetMapは管理レベル情報を持つはず
      expect(metadata.adminLevels).toBeDefined();
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('無効な国コードでエラーが適切にハンドリングされる', async () => {
      // Given: 無効な国コード
      const invalidCountryCode = 'XX';
      const dataSource: DataSourceName = 'naturalearth';
      
      // When & Then: 無効な国コードでエラーが発生する
      await expect(
        dataSourceManager.getCountryMetadata(dataSource, invalidCountryCode)
      ).rejects.toThrow('not found');
    });

    it('存在しないデータソースでエラーが発生する', async () => {
      // Given: 存在しないデータソース名
      const invalidDataSource = 'nonexistent' as DataSourceName;
      
      // When & Then: 存在しないデータソースでエラーが発生する
      await expect(
        dataSourceManager.getCountryMetadata(invalidDataSource, 'JP')
      ).rejects.toThrow('Data source nonexistent not found');
    });
  });

  describe('境界値テスト', () => {
    it('最大管理レベル数の処理が正常に動作する', async () => {
      // Given: 最大管理レベルを持つ国（通常5レベル程度）
      const dataSource: DataSourceName = 'gadm';
      const countryWithMaxLevels = 'USA'; // アメリカは多階層の管理区分を持つ
      
      // When: 最大レベルの管理区分メタデータを取得
      const metadata = await dataSourceManager.getCountryMetadata(dataSource, countryWithMaxLevels);
      
      // Then: すべての管理レベルが正常に取得される
      expect(metadata.adminLevels).toBeDefined();
      expect(metadata.adminLevels.length).toBeGreaterThan(3); // 州、郡、市レベル以上
      expect(metadata.adminLevels.length).toBeLessThanOrEqual(6); // 実用的な上限
    });
  });
});