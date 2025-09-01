/**
 * @file SimpleTableMetadataManager.ts
 * @description Table metadata management for Spreadsheet plugin
 * Refactored from Styler plugin with spreadsheet-plugin-specific database naming
 */

import Dexie, { Table } from 'dexie';
import type { CSVTableMetadata } from '@hierarchidb/ui-csv-extract';

/**
 * 【機能概要】: CSVテーブルメタデータのIndexedDB管理
 * 【実装方針】: Stylerから移植、データベース名をspreadsheetDBに変更
 * 【テスト対応】: 参照カウント管理とガベージコレクションのテスト
 * 🟢 信頼性レベル: Dexieベースの実証済み実装
 */
export class SimpleTableMetadataManager extends Dexie {
  csvMetadata!: Table<CSVTableMetadata>;

  constructor(dbName: string = 'spreadsheetDB') {
    super(dbName);
    
    // 【スキーマ定義】: CSV メタデータテーブル
    this.version(1).stores({
      csvMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    });
  }

  /**
   * 【機能概要】: 新しいCSVテーブルメタデータの作成
   * 【実装方針】: 参照カウント管理を含む作成処理
   * 【テスト対応】: メタデータ作成と参照追加の整合性テスト
   * 🟢 信頼性レベル: トランザクション保護
   */
  async create(metadata: CSVTableMetadata, pluginId: string): Promise<CSVTableMetadata> {
    return await this.transaction('rw', this.csvMetadata, async () => {
      // 【参照管理】: 初期参照プラグインの設定
      const metadataWithReference = {
        ...metadata,
        referencingPlugins: [pluginId],
      };
      
      await this.csvMetadata.add(metadataWithReference);
      return metadataWithReference;
    });
  }

  /**
   * 【機能概要】: テーブルメタデータの取得
   * 【実装方針】: プライマリキーによる単純取得
   * 🟢 信頼性レベル: Dexie標準機能
   */
  async get(tableId: string): Promise<CSVTableMetadata | undefined> {
    return await this.csvMetadata.get(tableId);
  }

  /**
   * 【機能概要】: 全テーブルメタデータの一覧取得
   * 【実装方針】: 作成日時降順でのソート
   * 【テスト対応】: ソート順序の確認テスト
   * 🟢 信頼性レベル: Dexie標準機能
   */
  async list(): Promise<CSVTableMetadata[]> {
    return await this.csvMetadata.orderBy('createdAt').reverse().toArray();
  }

  /**
   * 【機能概要】: ハッシュによるテーブル検索（重複排除用）
   * 【実装方針】: コンテンツハッシュでの一意検索
   * 【テスト対応】: 重複ファイルの検出確認テスト
   * 🟢 信頼性レベル: インデックス活用
   */
  async findByHash(contentHash: string): Promise<CSVTableMetadata | undefined> {
    return await this.csvMetadata.where('contentHash').equals(contentHash).first();
  }

  /**
   * 【機能概要】: プラグイン参照の追加
   * 【実装方針】: 重複排除を含む参照管理
   * 【テスト対応】: 同一プラグインからの重複参照防止テスト
   * 🟢 信頼性レベル: トランザクション保護
   */
  async addReference(tableId: string, pluginId: string): Promise<void> {
    await this.transaction('rw', this.csvMetadata, async () => {
      const metadata = await this.csvMetadata.get(tableId);
      if (metadata) {
        const currentReferences = metadata.referencingPlugins || [];
        
        // 【重複チェック】: 既に参照が存在する場合はスキップ
        if (!currentReferences.includes(pluginId)) {
          await this.csvMetadata.update(tableId, {
            referencingPlugins: [...currentReferences, pluginId],
          });
        }
      }
    });
  }

  /**
   * 【機能概要】: プラグイン参照の削除と自動ガベージコレクション
   * 【実装方針】: 参照が0になった場合の自動削除
   * 【テスト対応】: 参照カウント管理とガベージコレクションのテスト
   * 🟢 信頼性レベル: トランザクション保護
   * @returns boolean - テーブルが削除された場合はtrue
   */
  async removeReference(tableId: string, pluginId: string): Promise<boolean> {
    return await this.transaction('rw', this.csvMetadata, async () => {
      const metadata = await this.csvMetadata.get(tableId);
      if (metadata) {
        const currentReferences = metadata.referencingPlugins || [];
        const newReferences = currentReferences.filter(ref => ref !== pluginId);
        
        // 【参照削除】: 指定プラグインの参照を削除
        await this.csvMetadata.update(tableId, {
          referencingPlugins: newReferences,
        });
        
        // 【ガベージコレクション】: 参照が0になった場合は削除
        if (newReferences.length === 0) {
          await this.csvMetadata.delete(tableId);
          return true; // 削除実行
        }
      }
      
      return false; // 削除なし
    });
  }

  /**
   * 【機能概要】: テーブルの強制削除（参照無視）
   * 【実装方針】: 管理者機能としての強制削除
   * 【テスト対応】: 強制削除後の整合性確認テスト
   * 🟡 信頼性レベル: 通常は使用しない管理者機能
   */
  async forceDelete(tableId: string): Promise<void> {
    await this.csvMetadata.delete(tableId);
  }

  /**
   * 【機能概要】: プラグイン別参照一覧取得
   * 【実装方針】: 特定プラグインが参照するテーブル一覧
   * 【テスト対応】: プラグイン固有のテーブル一覧取得テスト
   * 🟢 信頼性レベル: 配列インデックス活用
   */
  async getTablesReferencedBy(pluginId: string): Promise<CSVTableMetadata[]> {
    return await this.csvMetadata
      .where('referencingPlugins')
      .anyOf([pluginId])
      .toArray();
  }

  /**
   * 【機能概要】: メタデータの更新
   * 【実装方針】: 部分更新サポート
   * 【テスト対応】: 更新項目の反映確認テスト
   * 🟢 信頼性レベル: Dexie標準機能
   */
  async update(tableId: string, updates: Partial<CSVTableMetadata>): Promise<void> {
    await this.csvMetadata.update(tableId, updates);
  }

  /**
   * 【機能概要】: 統計情報の取得
   * 【実装方針】: テーブル数、総行数などの統計
   * 【テスト対応】: 統計値の正確性確認テスト
   * 🟡 信頼性レベル: 集計処理、大容量時のパフォーマンス要検証
   */
  async getStatistics(): Promise<{
    totalTables: number;
    totalRows: number;
    totalSize: number;
    pluginReferenceCounts: Record<string, number>;
  }> {
    const allTables = await this.csvMetadata.toArray();
    
    const statistics = {
      totalTables: allTables.length,
      totalRows: allTables.reduce((sum, table) => sum + table.totalRows, 0),
      totalSize: allTables.reduce((sum, table) => {
        // ファイルサイズの概算（行数 × 推定バイト数）
        return sum + (table.totalRows * 50); // 1行あたり50バイト概算
      }, 0),
      pluginReferenceCounts: {} as Record<string, number>,
    };
    
    // 【プラグイン別参照カウント】: 各プラグインの参照数を集計
    allTables.forEach(table => {
      (table.referencingPlugins || []).forEach(pluginId => {
        statistics.pluginReferenceCounts[pluginId] = 
          (statistics.pluginReferenceCounts[pluginId] || 0) + 1;
      });
    });
    
    return statistics;
  }

  /**
   * 【機能概要】: 孤立テーブルの検出とクリーンアップ
   * 【実装方針】: 参照が空のテーブルを検出・削除
   * 【テスト対応】: 孤立テーブルの検出と削除確認テスト
   * 🟡 信頼性レベル: メンテナンス機能、慎重な実行が必要
   */
  async cleanupOrphanedTables(): Promise<string[]> {
    const deletedTableIds: string[] = [];
    
    await this.transaction('rw', this.csvMetadata, async () => {
      const allTables = await this.csvMetadata.toArray();
      
      for (const table of allTables) {
        if (!table.referencingPlugins || table.referencingPlugins.length === 0) {
          await this.csvMetadata.delete(table.id);
          deletedTableIds.push(table.id);
        }
      }
    });
    
    return deletedTableIds;
  }
}