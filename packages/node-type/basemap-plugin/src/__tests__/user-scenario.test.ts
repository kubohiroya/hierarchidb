import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import type { 
  NodeId, 
  TreeId, 
  EntityId,
  WorkingCopyId,
} from '@hierarchidb/common-core';
import { BaseMapEntityHandler } from '../BaseMapEntityHandler';
import type { 
  BaseMapEntity, 
  BaseMapWorkingCopy,
  CreateBaseMapData,
  TileLayer,
  Marker,
  Overlay,
  MapStyle,
  Viewport
} from '../types';

// Mock Worker environment
class MockWorker {
  private handler: BaseMapEntityHandler;
  private coreDb: Dexie;
  private ephemeralDb: Dexie;

  constructor() {
    this.coreDb = new Dexie('test-core-db');
    this.coreDb.version(1).stores({
      basemaps: 'id, name, createdAt',
      treeNodes: 'id, treeId, entityId, nodeType',
    });

    this.ephemeralDb = new Dexie('test-ephemeral-db');
    this.ephemeralDb.version(1).stores({
      workingCopies: 'id, entityId, entityType, status',
    });

    this.handler = new BaseMapEntityHandler(
      this.coreDb as any,
      this.ephemeralDb as any
    );
  }

  async cleanup() {
    await this.coreDb.delete();
    await this.ephemeralDb.delete();
  }
}

describe('BaseMap Plugin - ユーザシナリオテスト', () => {
  let worker: MockWorker;
  let handler: BaseMapEntityHandler;

  beforeEach(async () => {
    worker = new MockWorker();
    handler = worker['handler'];
  });

  afterEach(async () => {
    await worker.cleanup();
  });

  describe('シナリオ1: ベースマップノードの段階的作成', () => {
    it('TC1.1: 基本的な作成フロー', async () => {
      const nodeId = 'node-1' as NodeId;
      const workingCopyId = 'wc-1' as WorkingCopyId;

      const createData: CreateBaseMapData = {
        name: 'メインマップ',
        description: 'プロジェクトのメインマップ',
        mapType: 'openstreetmap',
        viewport: {
          center: {
            latitude: 35.6762,
            longitude: 139.6503
          },
          zoom: 13,
          bearing: 0,
          pitch: 0
        },
        layers: [],
        markers: [],
        metadata: {
          tags: ['メイン', '東京'],
          customProperties: {
            project: 'project-1'
          }
        }
      };

      // WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      expect(workingCopy).toBeDefined();
      expect(workingCopy.id).toBe(workingCopyId);
      expect(workingCopy.data.name).toBe('メインマップ');
      expect(workingCopy.data.viewport.zoom).toBe(13);
      expect(workingCopy.status).toBe('draft');

      // WorkingCopyをコミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity).toBeDefined();
      expect(entity.mapType).toBe('openstreetmap');
      expect(entity.viewport.center.latitude).toBe(35.6762);

      // CoreDBに保存されていることを確認
      const savedEntity = await handler.getEntity(entity.id);
      expect(savedEntity).toEqual(entity);
    });

    it('TC1.2: レイヤーの段階的追加', async () => {
      const nodeId = 'node-2' as NodeId;
      const workingCopyId = 'wc-2' as WorkingCopyId;

      const createData: CreateBaseMapData = {
        name: 'レイヤーマップ',
        description: '複数レイヤーのテスト',
        mapType: 'mapbox',
        viewport: {
          center: { latitude: 35.6762, longitude: 139.6503 },
          zoom: 10,
          bearing: 0,
          pitch: 0
        },
        layers: [],
        markers: []
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      // ベースタイルレイヤーを設定
      await handler.addLayer(workingCopyId, {
        id: 'base-layer',
        type: 'tile',
        source: {
          type: 'xyz',
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        },
        visible: true,
        opacity: 1.0,
        zIndex: 0
      });

      // 地形レイヤーを追加
      await handler.addLayer(workingCopyId, {
        id: 'terrain-layer',
        type: 'tile',
        source: {
          type: 'xyz',
          url: 'https://terrain-tiles.example.com/{z}/{x}/{y}.png'
        },
        visible: true,
        opacity: 0.5,
        zIndex: 1
      });

      // 交通情報オーバーレイを追加
      await handler.addLayer(workingCopyId, {
        id: 'traffic-overlay',
        type: 'overlay',
        source: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        },
        visible: true,
        opacity: 0.8,
        zIndex: 2
      });

      // カスタムタイルレイヤーを追加
      await handler.addLayer(workingCopyId, {
        id: 'custom-tiles',
        type: 'tile',
        source: {
          type: 'wms',
          url: 'https://custom-wms.example.com/service',
          layers: 'custom:layer'
        },
        visible: false,
        opacity: 1.0,
        zIndex: 3
      });

      // レイヤー順序を調整
      await handler.reorderLayers(workingCopyId, [
        'base-layer',
        'custom-tiles',
        'terrain-layer',
        'traffic-overlay'
      ]);

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity.layers).toHaveLength(4);
      expect(entity.layers[0].id).toBe('base-layer');
      expect(entity.layers[1].id).toBe('custom-tiles');
      expect(entity.layers[2].id).toBe('terrain-layer');
      expect(entity.layers[3].id).toBe('traffic-overlay');
    });

    it('TC1.3: マーカーとポリゴンの配置', async () => {
      const nodeId = 'node-3' as NodeId;
      const workingCopyId = 'wc-3' as WorkingCopyId;

      const createData: CreateBaseMapData = {
        name: 'マーカーマップ',
        description: 'マーカーとポリゴンのテスト',
        mapType: 'openstreetmap',
        viewport: {
          center: { latitude: 35.6762, longitude: 139.6503 },
          zoom: 12,
          bearing: 0,
          pitch: 0
        },
        layers: [],
        markers: []
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      // POIマーカーを複数配置
      const markers: Marker[] = [
        {
          id: 'marker-1',
          position: { latitude: 35.6812, longitude: 139.7671 },
          icon: 'default',
          title: '東京駅',
          popup: { content: '東京駅の情報', html: true }
        },
        {
          id: 'marker-2',
          position: { latitude: 35.6586, longitude: 139.7454 },
          icon: 'landmark',
          title: '東京タワー',
          popup: { content: '東京タワーの情報', html: true }
        },
        {
          id: 'marker-3',
          position: { latitude: 35.7148, longitude: 139.7967 },
          icon: 'custom',
          customIcon: {
            url: 'https://example.com/icon.png',
            size: [32, 32],
            anchor: [16, 32]
          },
          title: 'スカイツリー',
          popup: { content: 'スカイツリーの情報', html: true }
        }
      ];

      for (const marker of markers) {
        await handler.addMarker(workingCopyId, marker);
      }

      // エリアポリゴンを描画
      await handler.addOverlay(workingCopyId, {
        id: 'area-1',
        type: 'polygon',
        coordinates: [
          { latitude: 35.68, longitude: 139.76 },
          { latitude: 35.69, longitude: 139.76 },
          { latitude: 35.69, longitude: 139.77 },
          { latitude: 35.68, longitude: 139.77 },
          { latitude: 35.68, longitude: 139.76 }
        ],
        style: {
          fill: 'rgba(255, 0, 0, 0.3)',
          stroke: '#FF0000',
          strokeWidth: 2
        },
        popup: { content: 'エリア1', html: false }
      });

      // ポリライン（経路）を追加
      await handler.addOverlay(workingCopyId, {
        id: 'route-1',
        type: 'polyline',
        coordinates: [
          { latitude: 35.6812, longitude: 139.7671 },
          { latitude: 35.6762, longitude: 139.7503 },
          { latitude: 35.6586, longitude: 139.7454 }
        ],
        style: {
          stroke: '#0000FF',
          strokeWidth: 3,
          strokeDasharray: [5, 5]
        },
        popup: { content: '経路情報', html: false }
      });

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity.markers).toHaveLength(3);
      expect(entity.overlays).toHaveLength(2);
      expect(entity.markers[0].title).toBe('東京駅');
      expect(entity.overlays[0].type).toBe('polygon');
      expect(entity.overlays[1].type).toBe('polyline');
    });

    it('TC1.4: 作成中の中断と再開', async () => {
      const nodeId = 'node-4' as NodeId;
      const workingCopyId = 'wc-4' as WorkingCopyId;

      // 基本設定とレイヤーを追加
      const partialData: CreateBaseMapData = {
        name: '未完成マップ',
        description: '',
        mapType: 'openstreetmap',
        viewport: {
          center: { latitude: 35.6762, longitude: 139.6503 },
          zoom: 11,
          bearing: 0,
          pitch: 0
        },
        layers: [{
          id: 'base',
          type: 'tile',
          source: {
            type: 'xyz',
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          },
          visible: true,
          opacity: 1.0,
          zIndex: 0
        }],
        markers: []
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
      expect(resumedWorkingCopy?.data.layers).toHaveLength(1);

      // マーカーを追加
      await handler.addMarker(workingCopyId, {
        id: 'new-marker',
        position: { latitude: 35.68, longitude: 139.76 },
        icon: 'default',
        title: '追加マーカー'
      });

      // 説明を更新
      await handler.updateWorkingCopy(workingCopyId, {
        ...resumedWorkingCopy!.data,
        description: '完成した説明'
      });

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);
      expect(entity.description).toBe('完成した説明');
      expect(entity.markers).toHaveLength(1);
      expect(entity.layers).toHaveLength(1);
    });
  });

  describe('シナリオ2: 既存ベースマップノードの編集', () => {
    let existingEntity: BaseMapEntity;
    const entityId = 'basemap-1' as EntityId;

    beforeEach(async () => {
      // 既存ベースマップノードを作成
      existingEntity = await handler.createEntity(entityId, {
        name: '既存マップ',
        description: '編集前の説明',
        mapType: 'openstreetmap',
        viewport: {
          center: { latitude: 35.6762, longitude: 139.6503 },
          zoom: 10,
          bearing: 0,
          pitch: 0
        },
        layers: [{
          id: 'original-layer',
          type: 'tile',
          source: {
            type: 'xyz',
            url: 'https://original.example.com/{z}/{x}/{y}.png'
          },
          visible: true,
          opacity: 1.0,
          zIndex: 0
        }],
        markers: [{
          id: 'original-marker',
          position: { latitude: 35.68, longitude: 139.76 },
          icon: 'default',
          title: 'オリジナルマーカー'
        }],
        metadata: {
          tags: ['オリジナル']
        }
      });
    });

    it('TC2.1: レイヤー管理', async () => {
      const workingCopyId = 'wc-edit-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // 既存レイヤーを削除
      await handler.removeLayer(workingCopyId, 'original-layer');

      // 新しいレイヤーを追加
      await handler.addLayer(workingCopyId, {
        id: 'new-layer-1',
        type: 'tile',
        source: {
          type: 'xyz',
          url: 'https://new1.example.com/{z}/{x}/{y}.png'
        },
        visible: true,
        opacity: 0.8,
        zIndex: 0
      });

      await handler.addLayer(workingCopyId, {
        id: 'new-layer-2',
        type: 'overlay',
        source: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        },
        visible: true,
        opacity: 0.6,
        zIndex: 1
      });

      // レイヤー順序を変更
      await handler.reorderLayers(workingCopyId, ['new-layer-2', 'new-layer-1']);

      // レイヤー透明度を調整
      await handler.updateLayerOpacity(workingCopyId, 'new-layer-1', 0.5);

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);

      expect(updatedEntity.layers).toHaveLength(2);
      expect(updatedEntity.layers[0].id).toBe('new-layer-2');
      expect(updatedEntity.layers[1].id).toBe('new-layer-1');
      expect(updatedEntity.layers[1].opacity).toBe(0.5);
    });

    it('TC2.2: マップスタイル変更', async () => {
      const workingCopyId = 'wc-style-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // マップスタイルをダークテーマに変更
      await handler.updateMapStyle(workingCopyId, {
        theme: 'dark',
        colorPalette: {
          background: '#1a1a1a',
          roads: '#3a3a3a',
          water: '#001122',
          labels: '#ffffff'
        },
        labelSettings: {
          show: true,
          language: 'ja',
          fontSize: 12
        }
      });

      // プレビューで確認
      const preview = await handler.previewStyle(workingCopyId);
      expect(preview.theme).toBe('dark');
      expect(preview.colorPalette.background).toBe('#1a1a1a');

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);
      expect(updatedEntity.style?.theme).toBe('dark');
      expect(updatedEntity.style?.labelSettings?.language).toBe('ja');
    });

    it('TC2.3: ビューポート設定の更新', async () => {
      const workingCopyId = 'wc-viewport-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // ビューポート設定を更新
      await handler.updateViewport(workingCopyId, {
        center: { latitude: 34.6937, longitude: 135.5023 }, // 大阪
        zoom: 12,
        bearing: 45,
        pitch: 30,
        bounds: {
          north: 34.75,
          south: 34.60,
          east: 135.60,
          west: 135.40
        },
        minZoom: 5,
        maxZoom: 18
      });

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);

      expect(updatedEntity.viewport.center.latitude).toBe(34.6937);
      expect(updatedEntity.viewport.zoom).toBe(12);
      expect(updatedEntity.viewport.bearing).toBe(45);
      expect(updatedEntity.viewport.minZoom).toBe(5);
      expect(updatedEntity.viewport.maxZoom).toBe(18);
    });
  });

  describe('シナリオ3: マップデータのバッチ処理', () => {
    const mapIds: EntityId[] = [];

    beforeEach(async () => {
      // 複数のマップノードを作成
      for (let i = 1; i <= 5; i++) {
        const id = `map-batch-${i}` as EntityId;
        mapIds.push(id);

        // マーカーを持つマップを作成
        const markers: Marker[] = [];
        for (let j = 1; j <= 10; j++) {
          markers.push({
            id: `marker-${i}-${j}`,
            position: {
              latitude: 35.6762 + (Math.random() - 0.5) * 0.1,
              longitude: 139.6503 + (Math.random() - 0.5) * 0.1
            },
            icon: j % 2 === 0 ? 'default' : 'custom',
            title: `マーカー ${i}-${j}`
          });
        }

        await handler.createEntity(id, {
          name: `マップ ${i}`,
          description: `バッチテスト用マップ ${i}`,
          mapType: 'openstreetmap',
          viewport: {
            center: { latitude: 35.6762, longitude: 139.6503 },
            zoom: 11,
            bearing: 0,
            pitch: 0
          },
          layers: [{
            id: `layer-${i}`,
            type: 'tile',
            source: {
              type: 'xyz',
              url: `https://tile${i}.example.com/{z}/{x}/{y}.png`
            },
            visible: true,
            opacity: 0.8 + i * 0.04,
            zIndex: 0
          }],
          markers: markers
        });
      }
    });

    it('TC3.1: マーカーの一括スタイル変更', async () => {
      const batchId = 'batch-marker-style';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: mapIds,
        operations: [
          {
            type: 'updateMarkerStyle',
            filter: { icon: 'custom' },
            updates: {
              icon: 'updated',
              customIcon: {
                url: 'https://example.com/new-icon.png',
                size: [24, 24],
                anchor: [12, 24]
              }
            }
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      expect(results.processed).toBe(5);
      expect(results.failed).toBe(0);

      // 全選択マーカーのスタイルが更新されることを確認
      for (const id of mapIds) {
        const entity = await handler.getEntity(id);
        const customMarkers = entity?.markers.filter(m => m.icon === 'updated');
        expect(customMarkers?.length).toBeGreaterThan(0);
        customMarkers?.forEach(marker => {
          expect(marker.customIcon?.url).toBe('https://example.com/new-icon.png');
        });
      }
    });

    it('TC3.2: 自動クラスタリング', async () => {
      const batchId = 'batch-clustering';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: [mapIds[0]], // 最初のマップのみ
        operations: [
          {
            type: 'clusterMarkers',
            config: {
              enabled: true,
              distance: 50, // ピクセル
              minZoom: 8,
              maxZoom: 14,
              style: {
                small: { radius: 15, color: '#00FF00' },
                medium: { radius: 20, color: '#FFFF00' },
                large: { radius: 25, color: '#FF0000' }
              }
            }
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // クラスタリングが適用されることを確認
      const entity = await handler.getEntity(mapIds[0]);
      expect(entity?.clustering?.enabled).toBe(true);
      expect(entity?.clustering?.distance).toBe(50);
      expect(entity?.clustering?.style?.small?.color).toBe('#00FF00');
    });

    it('TC3.3: レイヤーの一括操作', async () => {
      const batchId = 'batch-layers';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: mapIds,
        operations: [
          {
            type: 'addCommonLayer',
            layer: {
              id: 'common-overlay',
              type: 'overlay',
              source: {
                type: 'geojson',
                data: {
                  type: 'FeatureCollection',
                  features: []
                }
              },
              visible: true,
              opacity: 0.7,
              zIndex: 10
            }
          },
          {
            type: 'updateLayerOpacity',
            filter: { type: 'tile' },
            opacity: 0.5
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // 全対象ノードのレイヤーが更新されることを確認
      for (const id of mapIds) {
        const entity = await handler.getEntity(id);
        
        // 共通レイヤーが追加されている
        const commonLayer = entity?.layers.find(l => l.id === 'common-overlay');
        expect(commonLayer).toBeDefined();
        expect(commonLayer?.opacity).toBe(0.7);
        
        // タイルレイヤーの透明度が統一されている
        const tileLayers = entity?.layers.filter(l => l.type === 'tile');
        tileLayers?.forEach(layer => {
          expect(layer.opacity).toBe(0.5);
        });
      }
    });

    it('TC3.4: タイルキャッシュ管理', async () => {
      const batchId = 'batch-cache';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: [mapIds[0]],
        operations: [
          {
            type: 'prefetchTiles',
            config: {
              bounds: {
                north: 35.70,
                south: 35.65,
                east: 139.70,
                west: 139.60
              },
              zoomLevels: [10, 11, 12, 13],
              maxTiles: 1000
            }
          }
        ]
      });

      // 進捗イベントリスナーを設定
      const progressEvents: any[] = [];
      handler.on('cacheProgress', (event) => {
        progressEvents.push(event);
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // タイルが効率的にキャッシュされることを確認
      expect(results.processed).toBe(1);
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // キャッシュ状態を確認
      const entity = await handler.getEntity(mapIds[0]);
      expect(entity?.tileCache?.enabled).toBe(true);
      expect(entity?.tileCache?.cachedTiles).toBeGreaterThan(0);
    });

    it('TC3.5: バッチ処理の進捗管理と中断', async () => {
      const batchId = 'batch-interrupt';
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: mapIds,
        operations: [
          {
            type: 'updateMetadata',
            metadata: { processed: true, timestamp: new Date().toISOString() }
          }
        ],
        processInChunks: true,
        chunkSize: 2
      });

      // 50%時点で中断（2/5件を処理）
      await handler.executeBatchChunk(batchId, 0);
      
      // 状態を確認
      let state = await handler.getBatchState(batchId);
      expect(state.processed).toBe(2);
      expect(state.total).toBe(5);
      expect(state.status).toBe('paused');

      // 処理を再開
      await handler.resumeBatch(batchId);
      
      // さらに2件処理
      await handler.executeBatchChunk(batchId, 1);
      
      // 残りを処理せずに破棄
      await handler.discardBatch(batchId);

      // 全変更がロールバックされることを確認
      for (const id of mapIds) {
        const entity = await handler.getEntity(id);
        expect(entity?.metadata?.processed).toBeUndefined();
      }
    });
  });

  describe('マップ要素別テスト', () => {
    it('タイルレイヤーの管理', async () => {
      const entityId = 'tile-test' as EntityId;
      
      const map = await handler.createEntity(entityId, {
        name: 'タイルテスト',
        description: '',
        mapType: 'custom',
        viewport: {
          center: { latitude: 35.6762, longitude: 139.6503 },
          zoom: 10,
          bearing: 0,
          pitch: 0
        },
        layers: [
          {
            id: 'raster-tiles',
            type: 'tile',
            source: {
              type: 'xyz',
              url: 'https://raster.example.com/{z}/{x}/{y}.png'
            },
            visible: true,
            opacity: 1.0,
            zIndex: 0
          },
          {
            id: 'vector-tiles',
            type: 'tile',
            source: {
              type: 'mvt',
              url: 'https://vector.example.com/{z}/{x}/{y}.pbf'
            },
            visible: true,
            opacity: 1.0,
            zIndex: 1
          },
          {
            id: 'wms-layer',
            type: 'tile',
            source: {
              type: 'wms',
              url: 'https://wms.example.com/service',
              layers: 'layer1,layer2',
              format: 'image/png'
            },
            visible: false,
            opacity: 0.8,
            zIndex: 2
          }
        ],
        markers: []
      });

      expect(map.layers).toHaveLength(3);
      expect(map.layers[0].source.type).toBe('xyz');
      expect(map.layers[1].source.type).toBe('mvt');
      expect(map.layers[2].source.type).toBe('wms');
    });

    it('オーバーレイ要素の管理', async () => {
      const entityId = 'overlay-test' as EntityId;
      const workingCopyId = 'wc-overlay' as WorkingCopyId;
      
      const map = await handler.createEntity(entityId, {
        name: 'オーバーレイテスト',
        description: '',
        mapType: 'openstreetmap',
        viewport: {
          center: { latitude: 35.6762, longitude: 139.6503 },
          zoom: 12,
          bearing: 0,
          pitch: 0
        },
        layers: [],
        markers: []
      });

      const wc = await handler.createWorkingCopyFromEntity(workingCopyId, entityId);

      // サークルを追加
      await handler.addOverlay(workingCopyId, {
        id: 'circle-1',
        type: 'circle',
        center: { latitude: 35.68, longitude: 139.76 },
        radius: 500, // メートル
        style: {
          fill: 'rgba(0, 0, 255, 0.3)',
          stroke: '#0000FF',
          strokeWidth: 2
        }
      });

      // ヒートマップを追加
      await handler.addOverlay(workingCopyId, {
        id: 'heatmap-1',
        type: 'heatmap',
        points: [
          { latitude: 35.68, longitude: 139.76, weight: 1.0 },
          { latitude: 35.69, longitude: 139.76, weight: 0.8 },
          { latitude: 35.68, longitude: 139.77, weight: 0.6 }
        ],
        config: {
          radius: 20,
          blur: 15,
          maxZoom: 16,
          gradient: {
            0.4: 'blue',
            0.6: 'cyan',
            0.7: 'lime',
            0.8: 'yellow',
            1.0: 'red'
          }
        }
      });

      const updated = await handler.commitWorkingCopy(workingCopyId);
      expect(updated.overlays).toHaveLength(2);
      expect(updated.overlays[0].type).toBe('circle');
      expect(updated.overlays[1].type).toBe('heatmap');
    });
  });
});

// Mock implementation helpers for BaseMapEntityHandler
declare module '../BaseMapEntityHandler' {
  interface BaseMapEntityHandler {
    createWorkingCopy(
      workingCopyId: WorkingCopyId,
      nodeId: NodeId,
      data: CreateBaseMapData
    ): Promise<BaseMapWorkingCopy>;
    
    updateWorkingCopy(
      workingCopyId: WorkingCopyId,
      data: Partial<BaseMapEntity>
    ): Promise<BaseMapWorkingCopy>;
    
    commitWorkingCopy(workingCopyId: WorkingCopyId): Promise<BaseMapEntity>;
    
    discardWorkingCopy(workingCopyId: WorkingCopyId): Promise<void>;
    
    getWorkingCopy(workingCopyId: WorkingCopyId): Promise<BaseMapWorkingCopy | null>;
    
    createWorkingCopyFromEntity(
      workingCopyId: WorkingCopyId,
      entityId: EntityId
    ): Promise<BaseMapWorkingCopy>;
    
    addLayer(workingCopyId: WorkingCopyId, layer: TileLayer): Promise<void>;
    removeLayer(workingCopyId: WorkingCopyId, layerId: string): Promise<void>;
    reorderLayers(workingCopyId: WorkingCopyId, layerIds: string[]): Promise<void>;
    updateLayerOpacity(workingCopyId: WorkingCopyId, layerId: string, opacity: number): Promise<void>;
    
    addMarker(workingCopyId: WorkingCopyId, marker: Marker): Promise<void>;
    addOverlay(workingCopyId: WorkingCopyId, overlay: Overlay): Promise<void>;
    
    updateMapStyle(workingCopyId: WorkingCopyId, style: MapStyle): Promise<void>;
    previewStyle(workingCopyId: WorkingCopyId): Promise<MapStyle>;
    
    updateViewport(workingCopyId: WorkingCopyId, viewport: Viewport): Promise<void>;
    
    createBatch(batchId: string, config: any): Promise<any>;
    executeBatch(batchId: string): Promise<any>;
    executeBatchChunk(batchId: string, chunkIndex: number): Promise<any>;
    getBatchState(batchId: string): Promise<any>;
    resumeBatch(batchId: string): Promise<any>;
    discardBatch(batchId: string): Promise<any>;
    
    on(event: string, handler: Function): void;
  }
}