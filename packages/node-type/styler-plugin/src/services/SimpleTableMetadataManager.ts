/**
 * @file SimpleTableMetadataManager.ts
 * @description CSVテーブルメタデータの永続化管理
 * 【機能概要】: CSVTableMetadata の IndexedDB への保存・取得・削除・参照管理
 * 【実装方針】: Dexie.js を使用したシンプルなCRUD操作とリファレンスカウンタ機能
 * 【テスト対応】: 参照管理、自動削除、重複検出の各テストケース対応
 * 🟢 信頼性レベル: IndexedDB標準パターンによる確実なデータ永続化
 */

import Dexie, { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { CSVTableMetadata } from '@hierarchidb/ui-csv-extract';

/**
 * 【データベース定義】: CSVテーブルメタデータ専用のIndexedDB
 * 【設計方針】: Styler専用の軽量データベース設計
 * 【テーブル設計】:
 *   - メイン: CSVTableMetadata の永続化
 *   - インデックス: contentHash による重複検出用
 */
interface CSVMetadataDB extends Dexie {
  csvMetadata: Table<CSVTableMetadata, string>;
}

/**
 * 【機能概要】: CSVテーブルメタデータの管理クラス
 * 【実装方針】: シングルトンパターンによるDB接続管理、参照カウント機能
 * 【テスト対応】: StylerCSVApiDriver.test.ts の全データ管理テストケース対応
 * 🟢 信頼性レベル: 確立されたDexie.jsパターンを使用
 */
export class SimpleTableMetadataManager {
  private db: CSVMetadataDB;

  /**
   * 【コンストラクタ】: データベース接続の初期化
   * 【実装方針】: Dexieを使用したIndexedDB接続とスキーマ定義
   * 【テスト対応】: beforeEach でのインスタンス作成に対応
   * 🟢 信頼性レベル: Dexie標準パターン
   */
  constructor() {
    // 【DB初期化】: Styler専用のCSVメタデータDB作成
    this.db = new Dexie(getDBName('styler-metadata-db')) as CSVMetadataDB;

    // 【スキーマ定義】: テーブル構造とインデックス設定
    this.db.version(1).stores({
      csvMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins', // 【インデックス】: プライマリキー、ハッシュ、ファイル名、作成日時、参照プラグイン
    });
  }

  /**
   * 【機能概要】: CSVテーブルメタデータの保存
   * 【実装方針】: 新規作成または既存データの更新
   * 【テスト対応】: uploadCSVFile のメタデータ保存機能
   * 🟢 信頼性レベル: Dexie.js標準のput操作
   * @param metadata - 保存するCSVテーブルメタデータ
   * @returns Promise<void>
   */
  async store(metadata: CSVTableMetadata): Promise<void> {
    try {
      // 【データ保存】: メタデータをIndexedDBに保存
      await this.db.csvMetadata.put(metadata);
    } catch (error) {
      // 【エラーハンドリング】: 保存失敗時の適切なエラー処理
      console.error('Failed to store CSV metadata:', error);
      throw new Error(
        `メタデータの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 【機能概要】: IDによるCSVテーブルメタデータの取得
   * 【実装方針】: プライマリキーによる高速検索
   * 【テスト対応】: getTableMetadata テストケース対応
   * 🟢 信頼性レベル: IndexedBの標準検索パターン
   * @param id - 取得対象のテーブルID
   * @returns Promise<CSVTableMetadata | null> - 見つかったメタデータまたはnull
   */
  async get(id: string): Promise<CSVTableMetadata | null> {
    try {
      // 【データ取得】: プライマリキーによる検索
      const result = await this.db.csvMetadata.get(id);
      return result || null;
    } catch (error) {
      // 【エラーハンドリング】: 取得失敗時の処理
      console.error('Failed to get CSV metadata:', error);
      return null;
    }
  }

  /**
   * 【機能概要】: 全CSVテーブルメタデータの取得
   * 【実装方針】: 全レコードの一括取得
   * 【テスト対応】: listTables のデータソース機能
   * 🟢 信頼性レベル: Dexie.js標準のtoArray操作
   * @returns Promise<CSVTableMetadata[]> - 全メタデータの配列
   */
  async getAll(): Promise<CSVTableMetadata[]> {
    try {
      // 【全データ取得】: テーブル内のすべてのメタデータを取得
      return await this.db.csvMetadata.toArray();
    } catch (error) {
      // 【エラーハンドリング】: 取得失敗時の処理
      console.error('Failed to get all CSV metadata:', error);
      return [];
    }
  }

  /**
   * 【機能概要】: CSVテーブルメタデータの削除
   * 【実装方針】: プライマリキーによる削除
   * 【テスト対応】: 自動削除、手動削除の各テストケース対応
   * 🟢 信頼性レベル: IndexedDB標準の削除パターン
   * @param id - 削除対象のテーブルID
   * @returns Promise<void>
   */
  async delete(id: string): Promise<void> {
    try {
      // 【データ削除】: 指定されたIDのメタデータを削除
      await this.db.csvMetadata.delete(id);
    } catch (error) {
      // 【エラーハンドリング】: 削除失敗時の処理
      console.error('Failed to delete CSV metadata:', error);
      throw new Error(
        `メタデータの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 【機能概要】: コンテンツハッシュによるメタデータ検索
   * 【実装方針】: contentHashインデックスを使用した高速検索
   * 【テスト対応】: ファイル重複検出のテストケース対応
   * 🟢 信頼性レベル: インデックス検索による確実な重複検出
   * @param hash - 検索対象のコンテンツハッシュ
   * @returns Promise<CSVTableMetadata | null> - 見つかったメタデータまたはnull
   */
  async findByContentHash(hash: string): Promise<CSVTableMetadata | null> {
    try {
      // 【ハッシュ検索】: contentHashインデックスを使用した検索
      const result = await this.db.csvMetadata.where('contentHash').equals(hash).first();

      return result || null;
    } catch (error) {
      // 【エラーハンドリング】: 検索失敗時の処理
      console.error('Failed to find CSV metadata by hash:', error);
      return null;
    }
  }

  /**
   * 【機能概要】: テーブル参照の追加
   * 【実装方針】: プラグインIDを参照リストに追加し、参照カウントを更新
   * 【テスト対応】: addTableReference テストケース対応
   * 🟢 信頼性レベル: トランザクション処理による整合性保証
   * @param tableId - 参照を追加するテーブルID
   * @param pluginId - 参照するプラグインID
   * @returns Promise<void>
   */
  async addReference(tableId: string, pluginId: string): Promise<void> {
    try {
      // 【トランザクション処理】: 参照追加の原子性を保証
      await this.db.transaction('rw', this.db.csvMetadata, async () => {
        // 【メタデータ取得】: 対象テーブルのメタデータを取得
        const metadata = await this.db.csvMetadata.get(tableId);

        if (!metadata) {
          throw new Error('Table not found');
        }

        // 【重複チェック】: 既に参照が存在するかチェック
        if (!metadata.referencingPlugins.includes(pluginId)) {
          // 【参照追加】: 新しいプラグインIDを追加
          metadata.referencingPlugins.push(pluginId);
          metadata.referenceCount = metadata.referencingPlugins.length;

          // 【メタデータ更新】: 変更されたメタデータを保存
          await this.db.csvMetadata.put(metadata);
        }
      });
    } catch (error) {
      // 【エラーハンドリング】: 参照追加失敗時の処理
      console.error('Failed to add table reference:', error);
      throw new Error(
        `参照の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 【機能概要】: テーブル参照の削除
   * 【実装方針】: プラグインIDを参照リストから削除し、参照カウントが0になったら自動削除
   * 【テスト対応】: removeTableReference、自動削除のテストケース対応
   * 🟢 信頼性レベル: トランザクション処理による整合性保証
   * @param tableId - 参照を削除するテーブルID
   * @param pluginId - 参照を削除するプラグインID
   * @returns Promise<void>
   */
  async removeReference(tableId: string, pluginId: string): Promise<void> {
    try {
      // 【トランザクション処理】: 参照削除の原子性を保証
      await this.db.transaction('rw', this.db.csvMetadata, async () => {
        // 【メタデータ取得】: 対象テーブルのメタデータを取得
        const metadata = await this.db.csvMetadata.get(tableId);

        if (!metadata) {
          throw new Error('Table not found');
        }

        // 【参照削除】: 指定されたプラグインIDを削除
        const index = metadata.referencingPlugins.indexOf(pluginId);
        if (index > -1) {
          metadata.referencingPlugins.splice(index, 1);
          metadata.referenceCount = metadata.referencingPlugins.length;

          // 【自動削除判定】: 参照カウントが0になったらメタデータを削除
          if (metadata.referenceCount === 0) {
            await this.db.csvMetadata.delete(tableId);
          } else {
            // 【メタデータ更新】: 参照カウントが残っている場合は更新
            await this.db.csvMetadata.put(metadata);
          }
        }
      });
    } catch (error) {
      // 【エラーハンドリング】: 参照削除失敗時の処理
      console.error('Failed to remove table reference:', error);
      throw new Error(
        `参照の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 【機能概要】: 全データのクリア
   * 【実装方針】: テーブル内の全レコードを削除
   * 【テスト対応】: afterEach でのテストデータクリアに対応
   * 🟢 信頼性レベル: Dexie.js標準のclear操作
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    try {
      // 【全データ削除】: テーブル内のすべてのデータを削除
      await this.db.csvMetadata.clear();
    } catch (error) {
      // 【エラーハンドリング】: クリア失敗時の処理
      console.error('Failed to clear CSV metadata:', error);
      throw new Error(
        `データのクリアに失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 【機能概要】: データベース接続のクローズ
   * 【実装方針】: Dexie接続の適切なクローズ処理
   * 【テスト対応】: テスト終了時のリソース解放
   * 🟢 信頼性レベル: Dexie.js標準のクローズパターン
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    try {
      // 【接続クローズ】: データベース接続を閉じてリソースを解放
      await this.db.close();
    } catch (error) {
      // 【エラーハンドリング】: クローズ失敗時の処理（通常は無害）
      console.error('Failed to close database:', error);
    }
  }
}
