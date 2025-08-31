import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import type { 
  NodeId, 
  TreeId, 
  EntityId,
  WorkingCopyId,
} from '@hierarchidb/common-core';
import { ShapeEntityHandler } from '../ShapeEntityHandler';
import type { 
  ShapeEntity, 
  ShapeWorkingCopy,
  CreateShapeData,
  ShapeType,
  ShapeStyle,
  Transform
} from '../types';

// Mock Worker environment
class MockWorker {
  private handler: ShapeEntityHandler;
  private coreDb: Dexie;
  private ephemeralDb: Dexie;

  constructor() {
    this.coreDb = new Dexie('test-core-db');
    this.coreDb.version(1).stores({
      shapes: 'id, type, createdAt',
      treeNodes: 'id, treeId, entityId, nodeType',
    });

    this.ephemeralDb = new Dexie('test-ephemeral-db');
    this.ephemeralDb.version(1).stores({
      workingCopies: 'id, entityId, entityType, status',
    });

    this.handler = new ShapeEntityHandler(
      this.coreDb as any,
      this.ephemeralDb as any
    );
  }

  async cleanup() {
    await this.coreDb.delete();
    await this.ephemeralDb.delete();
  }
}

describe('Shape Plugin - ユーザシナリオテスト', () => {
  let worker: MockWorker;
  let handler: ShapeEntityHandler;

  beforeEach(async () => {
    worker = new MockWorker();
    handler = worker['handler'];
  });

  afterEach(async () => {
    await worker.cleanup();
  });

  describe('シナリオ1: 図形ノードの段階的作成', () => {
    it('TC1.1: 基本的な作成フロー（矩形）', async () => {
      const nodeId = 'node-1' as NodeId;
      const workingCopyId = 'wc-1' as WorkingCopyId;

      const createData: CreateShapeData = {
        type: 'rectangle' as ShapeType,
        dimensions: {
          width: 100,
          height: 50
        },
        style: {
          fill: '#FF0000',
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1
        },
        position: { x: 0, y: 0 },
        rotation: 0
      };

      // WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      expect(workingCopy).toBeDefined();
      expect(workingCopy.id).toBe(workingCopyId);
      expect(workingCopy.data.type).toBe('rectangle');
      expect(workingCopy.data.dimensions.width).toBe(100);
      expect(workingCopy.data.dimensions.height).toBe(50);
      expect(workingCopy.status).toBe('draft');

      // スタイルを追加設定
      const updatedWorkingCopy = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...workingCopy.data,
          style: {
            ...workingCopy.data.style,
            shadow: {
              offsetX: 5,
              offsetY: 5,
              blur: 10,
              color: 'rgba(0,0,0,0.5)'
            }
          }
        }
      );

      expect(updatedWorkingCopy.data.style.shadow).toBeDefined();

      // WorkingCopyをコミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity).toBeDefined();
      expect(entity.type).toBe('rectangle');
      expect(entity.style.fill).toBe('#FF0000');
      expect(entity.style.shadow).toBeDefined();

      // CoreDBに保存されていることを確認
      const savedEntity = await handler.getEntity(entity.id);
      expect(savedEntity).toEqual(entity);
    });

    it('TC1.2: 複雑な図形の段階的作成（多角形）', async () => {
      const nodeId = 'node-2' as NodeId;
      const workingCopyId = 'wc-2' as WorkingCopyId;

      // 多角形の初期作成
      const createData: CreateShapeData = {
        type: 'polygon' as ShapeType,
        vertices: [],
        style: {
          fill: 'transparent',
          stroke: '#0000FF',
          strokeWidth: 1,
          opacity: 1
        },
        position: { x: 100, y: 100 },
        rotation: 0
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      // 頂点を順次追加
      const vertices = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 25, y: 75 },
        { x: 0, y: 50 }
      ];

      for (const vertex of vertices) {
        await handler.addVertexToPolygon(workingCopyId, vertex);
      }

      // グラデーション設定
      const withGradient = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...workingCopy.data,
          style: {
            ...workingCopy.data.style,
            fill: {
              type: 'gradient',
              gradient: {
                type: 'linear',
                angle: 45,
                stops: [
                  { offset: 0, color: '#FF0000' },
                  { offset: 0.5, color: '#FFFF00' },
                  { offset: 1, color: '#00FF00' }
                ]
              }
            }
          }
        }
      );

      // 影効果を追加
      const withShadow = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...withGradient.data,
          style: {
            ...withGradient.data.style,
            shadow: {
              offsetX: 10,
              offsetY: 10,
              blur: 20,
              color: 'rgba(0,0,0,0.3)'
            }
          }
        }
      );

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity.type).toBe('polygon');
      expect(entity.vertices).toHaveLength(5);
      expect(entity.style.fill).toHaveProperty('gradient');
      expect(entity.style.shadow).toBeDefined();
    });

    it('TC1.3: 作成中の中断と再開', async () => {
      const nodeId = 'node-3' as NodeId;
      const workingCopyId = 'wc-3' as WorkingCopyId;

      // 図形タイプと基本寸法を設定
      const partialData: CreateShapeData = {
        type: 'circle' as ShapeType,
        radius: 50,
        style: {
          fill: '#00FF00',
          stroke: 'none',
          strokeWidth: 0,
          opacity: 1
        },
        position: { x: 200, y: 200 },
        rotation: 0
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        partialData
      );

      // セッションを中断（WorkingCopyは保持される）
      
      // WorkingCopyを再読み込み
      const resumedWorkingCopy = await handler.getWorkingCopy(workingCopyId);
      expect(resumedWorkingCopy).toBeDefined();
      expect(resumedWorkingCopy?.data.type).toBe('circle');
      expect(resumedWorkingCopy?.data.radius).toBe(50);

      // スタイル設定を追加
      const completedWorkingCopy = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...resumedWorkingCopy!.data,
          style: {
            ...resumedWorkingCopy!.data.style,
            stroke: '#000000',
            strokeWidth: 3,
            strokeDasharray: [5, 5]
          }
        }
      );

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);
      expect(entity.style.strokeDasharray).toEqual([5, 5]);
    });

    it('TC1.4: 作成の破棄', async () => {
      const nodeId = 'node-4' as NodeId;
      const workingCopyId = 'wc-4' as WorkingCopyId;

      // 図形属性を完全に設定
      const data: CreateShapeData = {
        type: 'rectangle' as ShapeType,
        dimensions: { width: 200, height: 100 },
        style: {
          fill: '#FF00FF',
          stroke: '#000000',
          strokeWidth: 5,
          opacity: 0.8
        },
        position: { x: 50, y: 50 },
        rotation: 45
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

  describe('シナリオ2: 既存図形ノードの編集', () => {
    let existingEntity: ShapeEntity;
    const entityId = 'shape-1' as EntityId;

    beforeEach(async () => {
      // 既存図形ノードを作成（矩形）
      existingEntity = await handler.createEntity(entityId, {
        type: 'rectangle' as ShapeType,
        dimensions: { width: 100, height: 100 },
        style: {
          fill: '#0000FF',
          stroke: '#000000',
          strokeWidth: 1,
          opacity: 1
        },
        position: { x: 0, y: 0 },
        rotation: 0
      });
    });

    it('TC2.1: 形状変更（矩形から円へ）', async () => {
      const workingCopyId = 'wc-edit-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // 図形タイプを円に変更
      const updatedWorkingCopy = await handler.changeShapeType(
        workingCopyId,
        'circle',
        { radius: 50 }
      );

      expect(updatedWorkingCopy.data.type).toBe('circle');
      expect(updatedWorkingCopy.data.radius).toBe(50);
      expect(updatedWorkingCopy.data.dimensions).toBeUndefined();

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);

      expect(updatedEntity.type).toBe('circle');
      expect(updatedEntity.radius).toBe(50);
    });

    it('TC2.2: スタイル変更とプレビュー', async () => {
      const workingCopyId = 'wc-preview-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // 色を変更
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        style: {
          ...workingCopy.data.style,
          fill: '#FF0000'
        }
      });

      // プレビューで確認
      let preview = await handler.generatePreview(workingCopyId);
      expect(preview.style.fill).toBe('#FF0000');

      // 透明度を調整
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        style: {
          ...workingCopy.data.style,
          fill: '#FF0000',
          opacity: 0.5
        }
      });

      // 再度プレビュー
      preview = await handler.generatePreview(workingCopyId);
      expect(preview.style.opacity).toBe(0.5);

      // コミット
      const finalEntity = await handler.commitWorkingCopy(workingCopyId);
      expect(finalEntity.style.fill).toBe('#FF0000');
      expect(finalEntity.style.opacity).toBe(0.5);
    });

    it('TC2.3: 変形操作の適用', async () => {
      const workingCopyId = 'wc-transform-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // 回転角度を設定（45度）
      await handler.applyTransform(workingCopyId, {
        rotation: 45
      });

      // スケールを変更（1.5倍）
      await handler.applyTransform(workingCopyId, {
        scale: { x: 1.5, y: 1.5 }
      });

      // 位置を移動
      await handler.applyTransform(workingCopyId, {
        translation: { x: 100, y: 50 }
      });

      // コミット
      const transformedEntity = await handler.commitWorkingCopy(workingCopyId);

      expect(transformedEntity.rotation).toBe(45);
      expect(transformedEntity.transform?.scale).toEqual({ x: 1.5, y: 1.5 });
      expect(transformedEntity.position).toEqual({ x: 100, y: 50 });
    });
  });

  describe('シナリオ3: 図形ノードのバッチ処理', () => {
    const shapeIds: EntityId[] = [];

    beforeEach(async () => {
      // 複数の図形ノードを作成（異なるタイプ）
      const shapes = [
        { type: 'rectangle', dimensions: { width: 100, height: 50 } },
        { type: 'circle', radius: 30 },
        { type: 'rectangle', dimensions: { width: 80, height: 80 } },
        { type: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 50 }] },
        { type: 'circle', radius: 40 },
      ];

      for (let i = 0; i < shapes.length; i++) {
        const id = `shape-batch-${i}` as EntityId;
        shapeIds.push(id);
        await handler.createEntity(id, {
          ...shapes[i],
          style: {
            fill: i % 2 === 0 ? '#FF0000' : '#00FF00',
            stroke: '#000000',
            strokeWidth: 1,
            opacity: 1
          },
          position: { x: i * 100, y: 0 },
          rotation: 0
        } as any);
      }
    });

    it('TC3.1: スタイル一括変更', async () => {
      const batchId = 'batch-style-1';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: shapeIds,
        operations: [
          {
            type: 'updateStyle',
            style: {
              stroke: '#0000FF',
              strokeWidth: 3,
              opacity: 0.8
            }
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      expect(results.processed).toBe(5);
      expect(results.failed).toBe(0);

      // 全選択ノードのスタイルが更新されることを確認
      for (const id of shapeIds) {
        const entity = await handler.getEntity(id);
        expect(entity?.style.stroke).toBe('#0000FF');
        expect(entity?.style.strokeWidth).toBe(3);
        expect(entity?.style.opacity).toBe(0.8);
        // 図形タイプ固有の属性は保持される
        if (entity?.type === 'circle') {
          expect(entity.radius).toBeDefined();
        } else if (entity?.type === 'rectangle') {
          expect(entity.dimensions).toBeDefined();
        }
      }
    });

    it('TC3.2: 変形の一括適用', async () => {
      const batchId = 'batch-transform-1';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: shapeIds,
        operations: [
          {
            type: 'transform',
            transform: {
              scale: { x: 0.5, y: 0.5 },
              rotation: 90
            }
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // 全ノードに変形が適用されることを確認
      for (const id of shapeIds) {
        const entity = await handler.getEntity(id);
        expect(entity?.transform?.scale).toEqual({ x: 0.5, y: 0.5 });
        expect(entity?.rotation).toBe(90);
      }
    });

    it('TC3.3: 条件付きバッチ処理', async () => {
      const batchId = 'batch-conditional-1';
      
      // フィルタ条件を設定（赤色の図形のみ）
      const batch = await handler.createBatch(batchId, {
        filter: {
          style: { fill: '#FF0000' }
        },
        operations: [
          {
            type: 'updateStyle',
            style: { fill: '#0000FF' }
          }
        ]
      });

      // プレビューで対象を確認
      const preview = await handler.previewBatch(batchId);
      expect(preview.targetCount).toBe(3); // 偶数インデックスの3つ

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // 条件に合致するノードのみが変更されることを確認
      for (let i = 0; i < shapeIds.length; i++) {
        const entity = await handler.getEntity(shapeIds[i]);
        if (i % 2 === 0) {
          expect(entity?.style.fill).toBe('#0000FF');
        } else {
          expect(entity?.style.fill).toBe('#00FF00');
        }
      }
    });

    it('TC3.4: バッチ処理の進捗管理', async () => {
      // 大量の図形ノードを追加
      const largeShapeIds: EntityId[] = [];
      for (let i = 0; i < 100; i++) {
        const id = `shape-large-${i}` as EntityId;
        largeShapeIds.push(id);
        await handler.createEntity(id, {
          type: 'circle' as ShapeType,
          radius: 20,
          style: {
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 1,
            opacity: 1
          },
          position: { x: 0, y: 0 },
          rotation: 0
        });
      }

      const batchId = 'batch-progress';
      const progressEvents: any[] = [];

      // 進捗イベントリスナーを設定
      handler.on('batchProgress', (event) => {
        progressEvents.push(event);
      });

      // バッチ処理開始
      const batch = await handler.createBatch(batchId, {
        entityIds: largeShapeIds,
        operations: [
          {
            type: 'updateStyle',
            style: { fill: '#FF00FF' }
          }
        ]
      });

      // 処理を実行
      const startTime = Date.now();
      await handler.executeBatch(batchId);
      const endTime = Date.now();

      // 進捗が正確に報告されることを確認
      expect(progressEvents.length).toBeGreaterThan(0);
      
      const lastProgress = progressEvents[progressEvents.length - 1];
      expect(lastProgress.processed).toBe(100);
      expect(lastProgress.total).toBe(100);
      expect(lastProgress.percentage).toBe(100);

      // パフォーマンス基準を確認（1000件/秒以上）
      const processingTime = endTime - startTime;
      const itemsPerSecond = (100 / processingTime) * 1000;
      expect(itemsPerSecond).toBeGreaterThan(1000);
    });

    it('TC3.5: バッチ処理の中断・再開・破棄', async () => {
      const batchId = 'batch-interrupt';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: shapeIds,
        operations: [
          {
            type: 'updateStyle',
            style: { fill: '#FFFF00' }
          }
        ],
        processInChunks: true,
        chunkSize: 2
      });

      // 30%時点で中断（2/5件処理）
      await handler.executeBatchChunk(batchId, 0);
      
      // 状態を確認
      let state = await handler.getBatchState(batchId);
      expect(state.processed).toBe(2);
      expect(state.status).toBe('paused');

      // 処理を再開
      await handler.resumeBatch(batchId);
      
      // さらに2件処理
      await handler.executeBatchChunk(batchId, 1);
      
      // 完了前に破棄を選択
      await handler.discardBatch(batchId);

      // 全変更がロールバックされることを確認
      for (let i = 0; i < shapeIds.length; i++) {
        const entity = await handler.getEntity(shapeIds[i]);
        // 元の色に戻っている
        expect(entity?.style.fill).toBe(i % 2 === 0 ? '#FF0000' : '#00FF00');
      }
    });
  });

  describe('図形タイプ別テスト', () => {
    it('矩形の属性管理', async () => {
      const entityId = 'rect-test' as EntityId;
      
      const rect = await handler.createEntity(entityId, {
        type: 'rectangle' as ShapeType,
        dimensions: { width: 200, height: 100 },
        cornerRadius: 10,
        style: {
          fill: '#FF0000',
          stroke: '#000000',
          strokeWidth: 2,
          opacity: 1
        },
        position: { x: 0, y: 0 },
        rotation: 0
      });

      expect(rect.dimensions.width).toBe(200);
      expect(rect.dimensions.height).toBe(100);
      expect(rect.cornerRadius).toBe(10);

      // アスペクト比を保持してリサイズ
      const workingCopyId = 'wc-rect' as WorkingCopyId;
      const wc = await handler.createWorkingCopyFromEntity(workingCopyId, entityId);
      await handler.resizeShape(workingCopyId, { width: 400 }, true);
      
      const resized = await handler.commitWorkingCopy(workingCopyId);
      expect(resized.dimensions.width).toBe(400);
      expect(resized.dimensions.height).toBe(200); // アスペクト比保持
    });

    it('円の属性管理', async () => {
      const entityId = 'circle-test' as EntityId;
      
      const circle = await handler.createEntity(entityId, {
        type: 'circle' as ShapeType,
        radius: 50,
        style: {
          fill: '#00FF00',
          stroke: '#000000',
          strokeWidth: 1,
          opacity: 1
        },
        position: { x: 100, y: 100 },
        rotation: 0
      });

      expect(circle.radius).toBe(50);

      // 楕円への変形
      const workingCopyId = 'wc-circle' as WorkingCopyId;
      const wc = await handler.createWorkingCopyFromEntity(workingCopyId, entityId);
      await handler.changeShapeType(workingCopyId, 'ellipse', {
        radiusX: 60,
        radiusY: 40
      });
      
      const ellipse = await handler.commitWorkingCopy(workingCopyId);
      expect(ellipse.type).toBe('ellipse');
      expect(ellipse.radiusX).toBe(60);
      expect(ellipse.radiusY).toBe(40);
    });

    it('多角形の頂点管理', async () => {
      const entityId = 'polygon-test' as EntityId;
      
      // 正三角形として作成
      const triangle = await handler.createEntity(entityId, {
        type: 'polygon' as ShapeType,
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 86.6 }
        ],
        style: {
          fill: '#0000FF',
          stroke: '#FFFFFF',
          strokeWidth: 2,
          opacity: 1
        },
        position: { x: 0, y: 0 },
        rotation: 0
      });

      expect(triangle.vertices).toHaveLength(3);

      // 頂点を追加して四角形に変換
      const workingCopyId = 'wc-polygon' as WorkingCopyId;
      const wc = await handler.createWorkingCopyFromEntity(workingCopyId, entityId);
      await handler.addVertexToPolygon(workingCopyId, { x: 0, y: 86.6 }, 2);
      
      const quad = await handler.commitWorkingCopy(workingCopyId);
      expect(quad.vertices).toHaveLength(4);

      // 正多角形への変換
      const wc2Id = 'wc-polygon-2' as WorkingCopyId;
      const wc2 = await handler.createWorkingCopyFromEntity(wc2Id, entityId);
      await handler.convertToRegularPolygon(wc2Id, 6, 50); // 正六角形、半径50
      
      const hexagon = await handler.commitWorkingCopy(wc2Id);
      expect(hexagon.vertices).toHaveLength(6);
    });
  });
});

// Mock implementation helpers for ShapeEntityHandler
declare module '../ShapeEntityHandler' {
  interface ShapeEntityHandler {
    createWorkingCopy(
      workingCopyId: WorkingCopyId,
      nodeId: NodeId,
      data: CreateShapeData
    ): Promise<ShapeWorkingCopy>;
    
    updateWorkingCopy(
      workingCopyId: WorkingCopyId,
      data: Partial<ShapeEntity>
    ): Promise<ShapeWorkingCopy>;
    
    commitWorkingCopy(workingCopyId: WorkingCopyId): Promise<ShapeEntity>;
    
    discardWorkingCopy(workingCopyId: WorkingCopyId): Promise<void>;
    
    getWorkingCopy(workingCopyId: WorkingCopyId): Promise<ShapeWorkingCopy | null>;
    
    createWorkingCopyFromEntity(
      workingCopyId: WorkingCopyId,
      entityId: EntityId
    ): Promise<ShapeWorkingCopy>;
    
    addVertexToPolygon(
      workingCopyId: WorkingCopyId,
      vertex: { x: number; y: number },
      index?: number
    ): Promise<void>;
    
    changeShapeType(
      workingCopyId: WorkingCopyId,
      newType: ShapeType,
      typeSpecificProps: any
    ): Promise<ShapeWorkingCopy>;
    
    generatePreview(workingCopyId: WorkingCopyId): Promise<ShapeEntity>;
    
    applyTransform(
      workingCopyId: WorkingCopyId,
      transform: Partial<Transform>
    ): Promise<void>;
    
    resizeShape(
      workingCopyId: WorkingCopyId,
      dimensions: any,
      maintainAspectRatio?: boolean
    ): Promise<void>;
    
    convertToRegularPolygon(
      workingCopyId: WorkingCopyId,
      sides: number,
      radius: number
    ): Promise<void>;
    
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