import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import type { 
  NodeId, 
  TreeId, 
  EntityId,
  WorkingCopyId,
  TreeNodeEntity,
} from '@hierarchidb/common-core';
import { FolderEntityHandler } from '../FolderEntityHandler';
import type { 
  FolderEntity, 
  FolderWorkingCopy,
  CreateFolderData,
  FolderFilterCriteria 
} from '../types';

// Mock Worker environment
class MockWorker {
  private handler: FolderEntityHandler;
  private coreDb: Dexie;
  private ephemeralDb: Dexie;

  constructor() {
    this.coreDb = new Dexie('test-core-db');
    this.coreDb.version(1).stores({
      folders: 'id, name, parentId',
      treeNodes: 'id, treeId, entityId, nodeType',
    });

    this.ephemeralDb = new Dexie('test-ephemeral-db');
    this.ephemeralDb.version(1).stores({
      workingCopies: 'id, entityId, entityType, status',
    });

    this.handler = new FolderEntityHandler(
      this.coreDb as any,
      this.ephemeralDb as any
    );
  }

  async cleanup() {
    await this.coreDb.delete();
    await this.ephemeralDb.delete();
  }
}

describe('Folder Plugin - ユーザシナリオテスト', () => {
  let worker: MockWorker;
  let handler: FolderEntityHandler;

  beforeEach(async () => {
    worker = new MockWorker();
    handler = worker['handler'];
  });

  afterEach(async () => {
    await worker.cleanup();
  });

  describe('シナリオ1: フォルダノードの段階的作成', () => {
    it('TC1.1: 基本的な作成フロー', async () => {
      // WorkingCopyを作成
      const nodeId = 'node-1' as NodeId;
      const treeId = 'tree-1' as TreeId;
      const workingCopyId = 'wc-1' as WorkingCopyId;

      const createData: CreateFolderData = {
        name: 'プロジェクトフォルダ',
        description: 'プロジェクト用のメインフォルダ',
        parentId: null,
        metadata: {
          tags: ['重要', 'プロジェクト'],
          customProperties: {
            priority: 'high',
            owner: 'user-1'
          }
        }
      };

      // WorkingCopyの作成
      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      expect(workingCopy).toBeDefined();
      expect(workingCopy.id).toBe(workingCopyId);
      expect(workingCopy.data.name).toBe('プロジェクトフォルダ');
      expect(workingCopy.status).toBe('draft');

      // メタデータを追加
      const updatedWorkingCopy = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...workingCopy.data,
          metadata: {
            ...workingCopy.data.metadata,
            tags: [...(workingCopy.data.metadata?.tags || []), '2024年度']
          }
        }
      );

      expect(updatedWorkingCopy.data.metadata?.tags).toContain('2024年度');

      // WorkingCopyをコミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity).toBeDefined();
      expect(entity.name).toBe('プロジェクトフォルダ');
      expect(entity.metadata?.tags).toContain('2024年度');

      // CoreDBに保存されていることを確認
      const savedEntity = await handler.getEntity(entity.id);
      expect(savedEntity).toEqual(entity);
    });

    it('TC1.2: 作成中の中断と再開', async () => {
      const nodeId = 'node-2' as NodeId;
      const workingCopyId = 'wc-2' as WorkingCopyId;

      // WorkingCopyに部分的な情報を設定
      const partialData: CreateFolderData = {
        name: '未完成フォルダ',
        description: '',
        parentId: null,
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        partialData
      );

      // セッションを中断（WorkingCopyは保持される）
      // 実際のアプリケーションではブラウザのタブを閉じる等に相当

      // WorkingCopyを再読み込み
      const resumedWorkingCopy = await handler.getWorkingCopy(workingCopyId);
      expect(resumedWorkingCopy).toBeDefined();
      expect(resumedWorkingCopy?.data.name).toBe('未完成フォルダ');

      // 残りの情報を設定
      const completedWorkingCopy = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...resumedWorkingCopy!.data,
          description: '完成した説明',
          metadata: {
            tags: ['再開後に追加'],
            customProperties: {
              status: 'completed'
            }
          }
        }
      );

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);
      expect(entity.description).toBe('完成した説明');
      expect(entity.metadata?.tags).toContain('再開後に追加');
    });

    it('TC1.3: 作成の破棄', async () => {
      const nodeId = 'node-3' as NodeId;
      const workingCopyId = 'wc-3' as WorkingCopyId;

      // WorkingCopyに情報を設定
      const data: CreateFolderData = {
        name: '破棄されるフォルダ',
        description: 'このフォルダは保存されない',
        parentId: null,
      };

      await handler.createWorkingCopy(workingCopyId, nodeId, data);

      // WorkingCopyを破棄
      await handler.discardWorkingCopy(workingCopyId);

      // EphemeralDBからWorkingCopyが削除されていることを確認
      const discardedWorkingCopy = await handler.getWorkingCopy(workingCopyId);
      expect(discardedWorkingCopy).toBeNull();

      // CoreDBに何も保存されていないことを確認
      const entities = await handler.listEntities();
      expect(entities).toHaveLength(0);
    });
  });

  describe('シナリオ2: 既存フォルダノードの編集', () => {
    let existingEntity: FolderEntity;
    const entityId = 'folder-1' as EntityId;

    beforeEach(async () => {
      // 既存フォルダノードを作成
      existingEntity = await handler.createEntity(entityId, {
        name: '既存フォルダ',
        description: '編集前の説明',
        parentId: null,
        metadata: {
          tags: ['オリジナル'],
          customProperties: {
            version: '1.0'
          }
        }
      });
    });

    it('TC2.1: 基本的な編集フロー', async () => {
      const workingCopyId = 'wc-edit-1' as WorkingCopyId;

      // 既存ノードからWorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      expect(workingCopy.originalEntityId).toBe(entityId);
      expect(workingCopy.data.name).toBe('既存フォルダ');

      // 各属性を変更
      const updatedWorkingCopy = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...workingCopy.data,
          name: '更新されたフォルダ',
          description: '編集後の説明',
          metadata: {
            tags: ['オリジナル', '更新済み'],
            customProperties: {
              version: '2.0',
              lastModified: new Date().toISOString()
            }
          }
        }
      );

      // 変更をコミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);

      expect(updatedEntity.id).toBe(entityId);
      expect(updatedEntity.name).toBe('更新されたフォルダ');
      expect(updatedEntity.description).toBe('編集後の説明');
      expect(updatedEntity.metadata?.customProperties?.version).toBe('2.0');
    });

    it('TC2.2: 編集のプレビューと確認', async () => {
      const workingCopyId = 'wc-preview-1' as WorkingCopyId;

      // WorkingCopyで変更
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        name: 'プレビューフォルダ',
        description: 'プレビュー用の説明'
      });

      // 変更内容をプレビュー（差分を確認）
      const preview = await handler.previewChanges(workingCopyId);
      
      expect(preview.changes).toContainEqual({
        field: 'name',
        oldValue: '既存フォルダ',
        newValue: 'プレビューフォルダ'
      });
      expect(preview.changes).toContainEqual({
        field: 'description',
        oldValue: '編集前の説明',
        newValue: 'プレビュー用の説明'
      });

      // 必要に応じて再編集
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        name: 'プレビューフォルダ（修正版）',
      });

      // 最終確認後コミット
      const finalEntity = await handler.commitWorkingCopy(workingCopyId);
      expect(finalEntity.name).toBe('プレビューフォルダ（修正版）');
    });

    it('TC2.3: 編集の破棄とやり直し', async () => {
      const workingCopyId1 = 'wc-discard-1' as WorkingCopyId;
      const workingCopyId2 = 'wc-discard-2' as WorkingCopyId;

      // 最初の変更
      const workingCopy1 = await handler.createWorkingCopyFromEntity(
        workingCopyId1,
        entityId
      );
      await handler.updateWorkingCopy(workingCopyId1, {
        ...workingCopy1.data,
        name: '破棄される変更',
      });

      // 変更を破棄
      await handler.discardWorkingCopy(workingCopyId1);

      // 新しいWorkingCopyを作成
      const workingCopy2 = await handler.createWorkingCopyFromEntity(
        workingCopyId2,
        entityId
      );

      // 別の変更を行う
      await handler.updateWorkingCopy(workingCopyId2, {
        ...workingCopy2.data,
        name: '採用される変更',
      });

      // コミット
      const finalEntity = await handler.commitWorkingCopy(workingCopyId2);

      // 最初の変更が反映されず、2回目の変更のみが反映されることを確認
      expect(finalEntity.name).toBe('採用される変更');
      expect(finalEntity.name).not.toBe('破棄される変更');
    });
  });

  describe('シナリオ3: フォルダノードのバッチ処理', () => {
    const folderIds: EntityId[] = [];

    beforeEach(async () => {
      // 複数のフォルダノードを作成
      for (let i = 1; i <= 10; i++) {
        const id = `folder-batch-${i}` as EntityId;
        folderIds.push(id);
        await handler.createEntity(id, {
          name: `フォルダ ${i}`,
          description: `説明 ${i}`,
          parentId: null,
          metadata: {
            tags: [`tag-${i}`],
            customProperties: {
              index: i
            }
          }
        });
      }
    });

    it('TC3.1: 複数フォルダの一括更新', async () => {
      const batchId = 'batch-1';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: folderIds.slice(0, 5),
        operations: [
          {
            type: 'update',
            field: 'metadata.tags',
            value: (current: string[]) => [...current, 'バッチ処理済み']
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // 全選択ノードが更新されることを確認
      expect(results.processed).toBe(5);
      expect(results.failed).toBe(0);

      // 更新されたノードを確認
      for (let i = 0; i < 5; i++) {
        const entity = await handler.getEntity(folderIds[i]);
        expect(entity?.metadata?.tags).toContain('バッチ処理済み');
      }

      // 未選択のノードは更新されていないことを確認
      for (let i = 5; i < 10; i++) {
        const entity = await handler.getEntity(folderIds[i]);
        expect(entity?.metadata?.tags).not.toContain('バッチ処理済み');
      }
    });

    it('TC3.2: バッチ処理の進捗管理', async () => {
      const batchId = 'batch-progress';
      const progressEvents: any[] = [];

      // 進捗イベントリスナーを設定
      handler.on('batchProgress', (event) => {
        progressEvents.push(event);
      });

      // バッチ処理開始
      const batch = await handler.createBatch(batchId, {
        entityIds: folderIds,
        operations: [
          {
            type: 'update',
            field: 'description',
            value: '一括更新された説明'
          }
        ]
      });

      // 処理を実行
      await handler.executeBatch(batchId);

      // 進捗が正確に報告されることを確認
      expect(progressEvents.length).toBeGreaterThan(0);
      
      const lastProgress = progressEvents[progressEvents.length - 1];
      expect(lastProgress.processed).toBe(10);
      expect(lastProgress.total).toBe(10);
      expect(lastProgress.percentage).toBe(100);
    });

    it('TC3.3: バッチ処理の中断と再開', async () => {
      const batchId = 'batch-resume';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: folderIds,
        operations: [
          {
            type: 'update',
            field: 'name',
            value: (current: string) => `${current} (処理済み)`
          }
        ],
        processInChunks: true,
        chunkSize: 3
      });

      // 途中で中断
      await handler.executeBatchChunk(batchId, 0); // 最初の3件を処理
      
      const pausedState = await handler.getBatchState(batchId);
      expect(pausedState.processed).toBe(3);
      expect(pausedState.status).toBe('paused');

      // 処理を再開
      await handler.resumeBatch(batchId);

      // 全ノードが最終的に処理されることを確認
      const finalState = await handler.getBatchState(batchId);
      expect(finalState.processed).toBe(10);
      expect(finalState.status).toBe('completed');

      // 全てのノードが更新されていることを確認
      for (const id of folderIds) {
        const entity = await handler.getEntity(id);
        expect(entity?.name).toContain('(処理済み)');
      }
    });

    it('TC3.4: バッチ処理のプレビュー', async () => {
      const batchId = 'batch-preview';
      
      // バッチ処理を定義
      const batch = await handler.createBatch(batchId, {
        entityIds: folderIds.slice(0, 3),
        operations: [
          {
            type: 'update',
            field: 'description',
            value: 'プレビューテスト'
          }
        ]
      });

      // プレビューモードで実行
      const preview = await handler.previewBatch(batchId);

      // プレビュー結果を確認
      expect(preview.changes).toHaveLength(3);
      preview.changes.forEach(change => {
        expect(change.field).toBe('description');
        expect(change.newValue).toBe('プレビューテスト');
      });

      // プレビューでは実際の変更が行われないことを確認
      for (let i = 0; i < 3; i++) {
        const entity = await handler.getEntity(folderIds[i]);
        expect(entity?.description).not.toBe('プレビューテスト');
      }

      // 実際の処理を実行
      await handler.executeBatch(batchId);

      // プレビュー結果と実行結果が一致することを確認
      for (let i = 0; i < 3; i++) {
        const entity = await handler.getEntity(folderIds[i]);
        expect(entity?.description).toBe('プレビューテスト');
      }
    });

    it('TC3.5: バッチ処理の破棄', async () => {
      const batchId = 'batch-discard';
      const originalEntities = await Promise.all(
        folderIds.map(id => handler.getEntity(id))
      );

      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: folderIds,
        operations: [
          {
            type: 'update',
            field: 'name',
            value: (current: string) => `${current} (破棄される)`
          }
        ],
        processInChunks: true,
        chunkSize: 5
      });

      // 部分的に処理を実行
      await handler.executeBatchChunk(batchId, 0); // 最初の5件を処理

      // 処理を破棄
      await handler.discardBatch(batchId);

      // 全ノードが元の状態に戻ることを確認
      for (let i = 0; i < folderIds.length; i++) {
        const entity = await handler.getEntity(folderIds[i]);
        expect(entity?.name).toBe(originalEntities[i]?.name);
        expect(entity?.name).not.toContain('(破棄される)');
      }
    });
  });
});

// Mock implementation helpers for FolderEntityHandler
// Note: These would typically be in the actual implementation file
declare module '../FolderEntityHandler' {
  interface FolderEntityHandler {
    createWorkingCopy(
      workingCopyId: WorkingCopyId,
      nodeId: NodeId,
      data: CreateFolderData
    ): Promise<FolderWorkingCopy>;
    
    updateWorkingCopy(
      workingCopyId: WorkingCopyId,
      data: Partial<FolderEntity>
    ): Promise<FolderWorkingCopy>;
    
    commitWorkingCopy(workingCopyId: WorkingCopyId): Promise<FolderEntity>;
    
    discardWorkingCopy(workingCopyId: WorkingCopyId): Promise<void>;
    
    getWorkingCopy(workingCopyId: WorkingCopyId): Promise<FolderWorkingCopy | null>;
    
    createWorkingCopyFromEntity(
      workingCopyId: WorkingCopyId,
      entityId: EntityId
    ): Promise<FolderWorkingCopy>;
    
    previewChanges(workingCopyId: WorkingCopyId): Promise<{
      changes: Array<{
        field: string;
        oldValue: any;
        newValue: any;
      }>;
    }>;
    
    createBatch(batchId: string, config: any): Promise<any>;
    executeBatch(batchId: string): Promise<any>;
    executeBatchChunk(batchId: string, chunkIndex: number): Promise<any>;
    getBatchState(batchId: string): Promise<any>;
    resumeBatch(batchId: string): Promise<any>;
    previewBatch(batchId: string): Promise<any>;
    discardBatch(batchId: string): Promise<any>;
    
    on(event: string, handler: Function): void;
  }
}