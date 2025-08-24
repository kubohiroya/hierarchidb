/**
 * Dexie Integration for Entity Managers
 * 
 * EntityManagersをDexie（IndexedDB）と統合する実装
 * メモリ内Mapから実際のデータベースへの移行
 * 
 * NOTE: This file was moved from common-core to worker package
 * as database operations should be in the worker layer, not in core types
 */

import Dexie, { Table } from 'dexie';
import type {
  PeerEntity,
  GroupEntity,
  RelationalEntity,
  Timestamp
} from '@hierarchidb/common-core';

/**
 * EntityManager用のDexieデータベース基底クラス
 */
export class EntityDatabase extends Dexie {
  // PeerEntity用テーブル
  peerEntities!: Table<PeerEntity>;
  
  // GroupEntity用テーブル
  groupEntities!: Table<GroupEntity>;
  
  // RelationalEntity用テーブル
  relationalEntities!: Table<RelationalEntity>;
  
  // EphemeralEntity用テーブル（有効期限付き）
  ephemeralPeerEntities!: Table<PeerEntity & { expiresAt: Timestamp }>;
  ephemeralGroupEntities!: Table<GroupEntity & { expiresAt: Timestamp }>;

  constructor(dbName: string) {
    super(dbName);
    
    this.version(1).stores({
      // PeerEntityストア（nodeIdで一意）
      peerEntities: 'nodeId, createdAt, updatedAt',
      
      // GroupEntityストア（複合キーとインデックス）
      groupEntities: '[nodeId+groupId], nodeId, groupId, sortOrder, createdAt',
      
      // RelationalEntityストア（entityIdで一意、参照カウント付き）
      relationalEntities: 'entityId, referenceCount, createdAt, updatedAt',
      
      // Ephemeralストア（有効期限インデックス付き）
      ephemeralPeerEntities: 'nodeId, expiresAt, createdAt',
      ephemeralGroupEntities: '[nodeId+groupId], expiresAt, workingCopyId, createdAt'
    });
  }
}

/**
 * DexieAdapter: EntityManagerのdb引数として使用
 * Dexieテーブルをラップして、EntityManagerが期待するインターフェースを提供
 */
export class DexieAdapter<T extends PeerEntity | GroupEntity | RelationalEntity> {
  constructor(
    private table: Table<T>,
    private entityType: 'peer' | 'group' | 'relational'
  ) {}

  /**
   * エンティティを追加
   */
  async add(entity: T): Promise<void> {
    await this.table.add(entity);
  }

  /**
   * エンティティを取得
   */
  async get(key: any): Promise<T | undefined> {
    if (this.entityType === 'peer') {
      return await this.table.where('nodeId').equals(key).first();
    } else if (this.entityType === 'group') {
      return await this.table.where('groupId').equals(key).first();
    } else {
      return await this.table.where('entityId').equals(key).first();
    }
  }

  /**
   * エンティティを更新
   */
  async put(entity: T): Promise<void> {
    await this.table.put(entity);
  }

  /**
   * エンティティを削除
   */
  async delete(key: any): Promise<void> {
    if (this.entityType === 'peer') {
      await this.table.where('nodeId').equals(key).delete();
    } else if (this.entityType === 'group') {
      await this.table.where('groupId').equals(key).delete();
    } else {
      await this.table.where('entityId').equals(key).delete();
    }
  }

  /**
   * 条件検索（GroupEntity用）
   */
  where(field: string): {
    equals: (value: any) => {
      toArray: () => Promise<T[]>;
      delete: () => Promise<number>;
    };
  } {
    return {
      equals: (value: any) => ({
        toArray: async () => {
          return await this.table.where(field).equals(value).toArray();
        },
        delete: async () => {
          return await this.table.where(field).equals(value).delete();
        }
      })
    };
  }

  /**
   * 一括削除
   */
  async bulkDelete(keys: any[]): Promise<void> {
    await this.table.bulkDelete(keys);
  }

  /**
   * すべて取得
   */
  async toArray(): Promise<T[]> {
    return await this.table.toArray();
  }

  /**
   * クリア
   */
  async clear(): Promise<void> {
    await this.table.clear();
  }
}

/**
 * 期限切れエンティティの自動クリーンアップ
 */
export class ExpirationCleaner {
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor(
    private ephemeralTables: Table<any>[],
    private intervalMs: number = 60000 // 1分ごとにチェック
  ) {}

  /**
   * クリーンアップを開始
   */
  start(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpired();
    }, this.intervalMs);
  }

  /**
   * クリーンアップを停止
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 期限切れエンティティを削除
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    
    for (const table of this.ephemeralTables) {
      try {
        // expiresAtが現在時刻より前のエンティティを削除
        await table.where('expiresAt').below(now).delete();
      } catch (error) {
        console.error('Failed to cleanup expired entities:', error);
      }
    }
  }
}

/**
 * トランザクション管理
 */
export class TransactionManager {
  constructor(private db: EntityDatabase) {}

  /**
   * トランザクション内で複数の操作を実行
   */
  async executeInTransaction<T>(
    operations: () => Promise<T>
  ): Promise<T> {
    return await this.db.transaction('rw', 
      [
        this.db.peerEntities,
        this.db.groupEntities,
        this.db.relationalEntities,
        this.db.ephemeralPeerEntities,
        this.db.ephemeralGroupEntities
      ],
      operations
    );
  }

  /**
   * 読み取り専用トランザクション
   */
  async readInTransaction<T>(
    operations: () => Promise<T>
  ): Promise<T> {
    return await this.db.transaction('r',
      [
        this.db.peerEntities,
        this.db.groupEntities,
        this.db.relationalEntities,
        this.db.ephemeralPeerEntities,
        this.db.ephemeralGroupEntities
      ],
      operations
    );
  }
}

/**
 * EntityManagerファクトリー（Dexie統合版）
 */
export class DexieEntityManagerFactory {
  private db: EntityDatabase;
  private expirationCleaner: ExpirationCleaner;
  private transactionManager: TransactionManager;

  constructor(dbName: string = 'EntityManagerDB') {
    this.db = new EntityDatabase(dbName);
    this.expirationCleaner = new ExpirationCleaner([
      this.db.ephemeralPeerEntities,
      this.db.ephemeralGroupEntities
    ]);
    this.transactionManager = new TransactionManager(this.db);
  }

  /**
   * データベースを開く
   */
  async open(): Promise<void> {
    await this.db.open();
    this.expirationCleaner.start();
  }

  /**
   * データベースを閉じる
   */
  async close(): Promise<void> {
    this.expirationCleaner.stop();
    await this.db.close();
  }

  /**
   * PeerEntity用アダプターを作成
   */
  createPeerAdapter<T extends PeerEntity>(): DexieAdapter<T> {
    return new DexieAdapter(this.db.peerEntities as Table<T>, 'peer');
  }

  /**
   * GroupEntity用アダプターを作成
   */
  createGroupAdapter<T extends GroupEntity>(): DexieAdapter<T> {
    return new DexieAdapter(this.db.groupEntities as Table<T>, 'group');
  }

  /**
   * RelationalEntity用アダプターを作成
   */
  createRelationalAdapter<T extends RelationalEntity>(): DexieAdapter<T> {
    return new DexieAdapter(this.db.relationalEntities as Table<T>, 'relational');
  }

  /**
   * EphemeralPeerEntity用アダプターを作成
   */
  createEphemeralPeerAdapter<T extends PeerEntity>(): DexieAdapter<T & { expiresAt: Timestamp }> {
    return new DexieAdapter(this.db.ephemeralPeerEntities as Table<T & { expiresAt: Timestamp }>, 'peer');
  }

  /**
   * EphemeralGroupEntity用アダプターを作成
   */
  createEphemeralGroupAdapter<T extends GroupEntity>(): DexieAdapter<T & { expiresAt: Timestamp }> {
    return new DexieAdapter(this.db.ephemeralGroupEntities as Table<T & { expiresAt: Timestamp }>, 'group');
  }

  /**
   * トランザクションマネージャーを取得
   */
  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }
}

// シングルトンインスタンス
let factoryInstance: DexieEntityManagerFactory | null = null;

/**
 * DexieEntityManagerFactoryのシングルトンインスタンスを取得
 */
export async function getDexieFactory(dbName?: string): Promise<DexieEntityManagerFactory> {
  if (!factoryInstance) {
    factoryInstance = new DexieEntityManagerFactory(dbName);
    await factoryInstance.open();
  }
  return factoryInstance;
}

/**
 * DexieEntityManagerFactoryをクリーンアップ
 */
export async function cleanupDexieFactory(): Promise<void> {
  if (factoryInstance) {
    await factoryInstance.close();
    factoryInstance = null;
  }
}