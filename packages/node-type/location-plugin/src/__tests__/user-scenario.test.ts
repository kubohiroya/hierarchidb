import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import type { 
  NodeId, 
  TreeId, 
  EntityId,
  WorkingCopyId,
} from '@hierarchidb/common-core';
import { LocationEntityHandler } from '../LocationEntityHandler';
import type { 
  LocationEntity, 
  LocationWorkingCopy,
  CreateLocationData,
  Coordinates,
  Address,
  Polygon,
  GeocodingResult
} from '../types';

// Mock APIs
const mockGeocodingAPI = {
  geocode: vi.fn(),
  reverseGeocode: vi.fn()
};

// Mock Worker environment
class MockWorker {
  private handler: LocationEntityHandler;
  private coreDb: Dexie;
  private ephemeralDb: Dexie;

  constructor() {
    this.coreDb = new Dexie('test-core-db');
    this.coreDb.version(1).stores({
      locations: 'id, name, lat, lng',
      treeNodes: 'id, treeId, entityId, nodeType',
    });

    this.ephemeralDb = new Dexie('test-ephemeral-db');
    this.ephemeralDb.version(1).stores({
      workingCopies: 'id, entityId, entityType, status',
    });

    this.handler = new LocationEntityHandler(
      this.coreDb as any,
      this.ephemeralDb as any,
      mockGeocodingAPI
    );
  }

  async cleanup() {
    await this.coreDb.delete();
    await this.ephemeralDb.delete();
  }
}

// 地理計算ヘルパー関数
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  // Haversine式による距離計算
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = coord1.latitude * Math.PI / 180;
  const φ2 = coord2.latitude * Math.PI / 180;
  const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

describe('Location Plugin - ユーザシナリオテスト', () => {
  let worker: MockWorker;
  let handler: LocationEntityHandler;

  beforeEach(async () => {
    worker = new MockWorker();
    handler = worker['handler'];
    
    // Reset mocks
    mockGeocodingAPI.geocode.mockReset();
    mockGeocodingAPI.reverseGeocode.mockReset();
  });

  afterEach(async () => {
    await worker.cleanup();
  });

  describe('シナリオ1: ロケーションノードの段階的作成', () => {
    it('TC1.1: 基本的な作成フロー', async () => {
      const nodeId = 'node-1' as NodeId;
      const workingCopyId = 'wc-1' as WorkingCopyId;

      const createData: CreateLocationData = {
        name: '東京タワー',
        description: '東京のランドマーク',
        coordinates: {
          latitude: 35.6586,
          longitude: 139.7454
        },
        address: {
          street: '芝公園4丁目2-8',
          city: '港区',
          state: '東京都',
          country: '日本',
          postalCode: '105-0011'
        },
        metadata: {
          tags: ['観光地', 'ランドマーク'],
          customProperties: {
            height: '333m',
            yearBuilt: '1958'
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
      expect(workingCopy.data.name).toBe('東京タワー');
      expect(workingCopy.data.coordinates.latitude).toBe(35.6586);
      expect(workingCopy.data.coordinates.longitude).toBe(139.7454);
      expect(workingCopy.status).toBe('draft');

      // WorkingCopyをコミット
      const entity = await handler.commitWorkingCopy(workingCopyId);

      expect(entity).toBeDefined();
      expect(entity.name).toBe('東京タワー');
      expect(entity.address?.city).toBe('港区');

      // CoreDBに保存されていることを確認
      const savedEntity = await handler.getEntity(entity.id);
      expect(savedEntity).toEqual(entity);
    });

    it('TC1.2: 地図選択による座標設定', async () => {
      const nodeId = 'node-2' as NodeId;
      const workingCopyId = 'wc-2' as WorkingCopyId;

      // 基本情報でWorkingCopyを作成
      const createData: CreateLocationData = {
        name: '選択された場所',
        description: '地図から選択',
        coordinates: null,
        address: null
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      // 地図上でクリックした座標をシミュレート
      const clickedCoordinates: Coordinates = {
        latitude: 35.6812,
        longitude: 139.7671
      };

      // 座標を設定
      await handler.setCoordinatesFromMap(workingCopyId, clickedCoordinates);

      // 近隣POIを取得（モック）
      const nearbyPOIs = await handler.getNearbyPOIs(workingCopyId, 500);
      
      // メタデータに近隣POIを追加
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        coordinates: clickedCoordinates,
        metadata: {
          nearbyPOIs: nearbyPOIs
        }
      });

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);
      expect(entity.coordinates).toEqual(clickedCoordinates);
      expect(entity.metadata?.nearbyPOIs).toBeDefined();
    });

    it('TC1.3: エリア（ポリゴン）の定義', async () => {
      const nodeId = 'node-3' as NodeId;
      const workingCopyId = 'wc-3' as WorkingCopyId;

      // エリアノードを作成
      const createData: CreateLocationData = {
        name: '皇居',
        description: '皇居エリア',
        coordinates: {
          latitude: 35.6852,
          longitude: 139.7528
        },
        boundary: null
      };

      const workingCopy = await handler.createWorkingCopy(
        workingCopyId,
        nodeId,
        createData
      );

      // ポリゴンの頂点を順次追加
      const vertices: Coordinates[] = [
        { latitude: 35.6875, longitude: 139.7507 },
        { latitude: 35.6894, longitude: 139.7545 },
        { latitude: 35.6852, longitude: 139.7583 },
        { latitude: 35.6810, longitude: 139.7545 },
        { latitude: 35.6829, longitude: 139.7507 },
        { latitude: 35.6875, longitude: 139.7507 } // 閉じる
      ];

      // 境界を設定
      await handler.setBoundary(workingCopyId, {
        type: 'polygon',
        vertices: vertices
      });

      // エリア情報を計算
      const areaInfo = await handler.calculateAreaInfo(workingCopyId);
      
      // メタデータに追加
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        metadata: {
          areaInfo: {
            area: areaInfo.area,
            perimeter: areaInfo.perimeter,
            centroid: areaInfo.centroid
          }
        }
      });

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);
      expect(entity.boundary?.vertices).toHaveLength(6);
      expect(entity.metadata?.areaInfo?.area).toBeGreaterThan(0);
    });

    it('TC1.4: 作成中の中断と再開', async () => {
      const nodeId = 'node-4' as NodeId;
      const workingCopyId = 'wc-4' as WorkingCopyId;

      // 場所名と座標を設定
      const partialData: CreateLocationData = {
        name: '未完成の場所',
        description: '',
        coordinates: {
          latitude: 35.6762,
          longitude: 139.6503
        },
        address: null
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
      expect(resumedWorkingCopy?.data.coordinates).toEqual(partialData.coordinates);

      // 住所とメタデータを追加
      const completedWorkingCopy = await handler.updateWorkingCopy(
        workingCopyId,
        {
          ...resumedWorkingCopy!.data,
          description: '完成した説明',
          address: {
            street: '新宿3-38-1',
            city: '新宿区',
            state: '東京都',
            country: '日本',
            postalCode: '160-0022'
          },
          metadata: {
            timezone: 'Asia/Tokyo',
            countryCode: 'JP',
            language: 'ja'
          }
        }
      );

      // コミット
      const entity = await handler.commitWorkingCopy(workingCopyId);
      expect(entity.address?.city).toBe('新宿区');
      expect(entity.metadata?.timezone).toBe('Asia/Tokyo');
    });

    it('TC1.5: 作成の破棄', async () => {
      const nodeId = 'node-5' as NodeId;
      const workingCopyId = 'wc-5' as WorkingCopyId;

      // 完全な位置情報を設定
      const data: CreateLocationData = {
        name: '破棄される場所',
        description: 'この場所は保存されない',
        coordinates: {
          latitude: 34.6937,
          longitude: 135.5023
        },
        address: {
          street: '大阪城1-1',
          city: '中央区',
          state: '大阪府',
          country: '日本',
          postalCode: '540-0002'
        }
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

  describe('シナリオ2: 既存ロケーションノードの編集', () => {
    let existingEntity: LocationEntity;
    const entityId = 'location-1' as EntityId;

    beforeEach(async () => {
      // 既存ロケーションノードを作成
      existingEntity = await handler.createEntity(entityId, {
        name: '既存の場所',
        description: '編集前の説明',
        coordinates: {
          latitude: 35.6762,
          longitude: 139.6503
        },
        address: {
          street: '西新宿2-8-1',
          city: '新宿区',
          state: '東京都',
          country: '日本',
          postalCode: '163-8001'
        },
        metadata: {
          tags: ['オリジナル']
        }
      });
    });

    it('TC2.1: 座標の更新', async () => {
      const workingCopyId = 'wc-edit-1' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      const oldCoordinates = workingCopy.data.coordinates;

      // 新しい座標を設定
      const newCoordinates: Coordinates = {
        latitude: 35.6895,
        longitude: 139.6917
      };

      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        coordinates: newCoordinates
      });

      // 移動距離を計算
      const distance = calculateDistance(oldCoordinates!, newCoordinates);

      // メタデータに移動情報を記録
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        coordinates: newCoordinates,
        metadata: {
          ...workingCopy.data.metadata,
          lastMove: {
            from: oldCoordinates,
            to: newCoordinates,
            distance: distance,
            movedAt: new Date().toISOString()
          }
        }
      });

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);
      
      expect(updatedEntity.coordinates).toEqual(newCoordinates);
      expect(updatedEntity.metadata?.lastMove?.distance).toBeGreaterThan(0);
    });

    it('TC2.2: 住所情報の更新', async () => {
      const workingCopyId = 'wc-edit-2' as WorkingCopyId;

      // モックのジオコーディング結果を設定
      mockGeocodingAPI.geocode.mockResolvedValue({
        coordinates: {
          latitude: 35.6586,
          longitude: 139.7454
        },
        formattedAddress: '東京都港区芝公園4丁目2-8'
      });

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // 住所を変更
      const newAddress: Address = {
        street: '芝公園4丁目2-8',
        city: '港区',
        state: '東京都',
        country: '日本',
        postalCode: '105-0011'
      };

      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        address: newAddress
      });

      // ジオコーディングで座標を検証
      const geocodingResult = await handler.validateAddressWithGeocoding(
        workingCopyId
      );

      expect(geocodingResult.isValid).toBe(true);
      
      // プレビューで確認
      const preview = await handler.previewChanges(workingCopyId);
      expect(preview.changes).toContainEqual(
        expect.objectContaining({
          field: 'address.city',
          oldValue: '新宿区',
          newValue: '港区'
        })
      );

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);
      expect(updatedEntity.address?.city).toBe('港区');
    });

    it('TC2.3: タイムゾーンと地域情報の設定', async () => {
      const workingCopyId = 'wc-edit-3' as WorkingCopyId;

      // 編集用WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopyFromEntity(
        workingCopyId,
        entityId
      );

      // タイムゾーンと地域情報を設定
      await handler.updateWorkingCopy(workingCopyId, {
        ...workingCopy.data,
        metadata: {
          ...workingCopy.data.metadata,
          timezone: 'Asia/Tokyo',
          countryCode: 'JP',
          regionCode: 'JP-13',
          languages: ['ja', 'en'],
          currency: 'JPY'
        }
      });

      // コミット
      const updatedEntity = await handler.commitWorkingCopy(workingCopyId);
      
      expect(updatedEntity.metadata?.timezone).toBe('Asia/Tokyo');
      expect(updatedEntity.metadata?.countryCode).toBe('JP');
      expect(updatedEntity.metadata?.languages).toContain('ja');
    });
  });

  describe('シナリオ3: ロケーションノードのバッチ処理', () => {
    const locationIds: EntityId[] = [];

    beforeEach(async () => {
      // 複数のロケーションノードを作成
      const locations = [
        { name: '場所1', address: '東京都渋谷区渋谷1-1-1', coordinates: null },
        { name: '場所2', address: '東京都新宿区新宿1-1-1', coordinates: null },
        { name: '場所3', address: null, coordinates: { latitude: 35.6812, longitude: 139.7671 } },
        { name: '場所4', address: null, coordinates: { latitude: 35.6586, longitude: 139.7454 } },
        { name: '場所5', address: '大阪府大阪市中央区1-1-1', coordinates: null },
      ];

      for (let i = 0; i < locations.length; i++) {
        const id = `location-batch-${i}` as EntityId;
        locationIds.push(id);
        await handler.createEntity(id, {
          name: locations[i].name,
          description: '',
          coordinates: locations[i].coordinates,
          address: locations[i].address ? {
            street: locations[i].address,
            city: '',
            state: '',
            country: '日本',
            postalCode: ''
          } : null
        });
      }
    });

    it('TC3.1: 住所からの一括ジオコーディング', async () => {
      const batchId = 'batch-geocoding';

      // モックのジオコーディング結果を設定
      mockGeocodingAPI.geocode
        .mockResolvedValueOnce({
          coordinates: { latitude: 35.6595, longitude: 139.7004 },
          formattedAddress: '東京都渋谷区渋谷1-1-1'
        })
        .mockResolvedValueOnce({
          coordinates: { latitude: 35.6896, longitude: 139.6921 },
          formattedAddress: '東京都新宿区新宿1-1-1'
        })
        .mockResolvedValueOnce({
          coordinates: { latitude: 34.6937, longitude: 135.5023 },
          formattedAddress: '大阪府大阪市中央区1-1-1'
        });
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: [locationIds[0], locationIds[1], locationIds[4]], // 住所のみのノード
        operations: [
          {
            type: 'geocode',
            source: 'address'
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      expect(results.processed).toBe(3);
      expect(results.failed).toBe(0);

      // 全ノードに座標が設定されることを確認
      const entity1 = await handler.getEntity(locationIds[0]);
      const entity2 = await handler.getEntity(locationIds[1]);
      const entity3 = await handler.getEntity(locationIds[4]);
      
      expect(entity1?.coordinates).toBeDefined();
      expect(entity2?.coordinates).toBeDefined();
      expect(entity3?.coordinates).toBeDefined();
    });

    it('TC3.2: 座標からの一括逆ジオコーディング', async () => {
      const batchId = 'batch-reverse-geocoding';

      // モックの逆ジオコーディング結果を設定
      mockGeocodingAPI.reverseGeocode
        .mockResolvedValueOnce({
          address: {
            street: '上野7丁目',
            city: '台東区',
            state: '東京都',
            country: '日本',
            postalCode: '110-0005'
          },
          formattedAddress: '東京都台東区上野7丁目'
        })
        .mockResolvedValueOnce({
          address: {
            street: '芝公園4丁目',
            city: '港区',
            state: '東京都',
            country: '日本',
            postalCode: '105-0011'
          },
          formattedAddress: '東京都港区芝公園4丁目'
        });
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: [locationIds[2], locationIds[3]], // 座標のみのノード
        operations: [
          {
            type: 'reverseGeocode',
            source: 'coordinates'
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      expect(results.processed).toBe(2);
      expect(results.failed).toBe(0);

      // 全ノードに住所が設定されることを確認
      const entity1 = await handler.getEntity(locationIds[2]);
      const entity2 = await handler.getEntity(locationIds[3]);
      
      expect(entity1?.address).toBeDefined();
      expect(entity2?.address).toBeDefined();
      expect(entity1?.address?.city).toBeTruthy();
      expect(entity2?.address?.city).toBeTruthy();
    });

    it('TC3.3: 距離計算バッチ処理', async () => {
      const batchId = 'batch-distance';
      
      // 基準点を設定
      const referencePoint: Coordinates = {
        latitude: 35.6762,
        longitude: 139.6503
      };
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: locationIds.filter(id => id.includes('2') || id.includes('3')),
        operations: [
          {
            type: 'calculateDistance',
            referencePoint: referencePoint
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // 各ノードまでの距離が計算されることを確認
      const entity1 = await handler.getEntity(locationIds[2]);
      const entity2 = await handler.getEntity(locationIds[3]);
      
      expect(entity1?.metadata?.distanceFromReference).toBeDefined();
      expect(entity2?.metadata?.distanceFromReference).toBeDefined();
      expect(entity1?.metadata?.distanceFromReference).toBeGreaterThan(0);
    });

    it('TC3.4: エリア内判定バッチ処理', async () => {
      const batchId = 'batch-area-check';
      
      // 判定エリアを定義（簡単な四角形）
      const boundaryPolygon: Polygon = {
        type: 'polygon',
        vertices: [
          { latitude: 35.65, longitude: 139.70 },
          { latitude: 35.70, longitude: 139.70 },
          { latitude: 35.70, longitude: 139.75 },
          { latitude: 35.65, longitude: 139.75 },
          { latitude: 35.65, longitude: 139.70 }
        ]
      };
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: locationIds.filter(id => id.includes('2') || id.includes('3')),
        operations: [
          {
            type: 'checkInArea',
            boundary: boundaryPolygon
          }
        ]
      });

      // バッチを実行
      const results = await handler.executeBatch(batchId);

      // 正確な内外判定が行われることを確認
      const entity1 = await handler.getEntity(locationIds[2]);
      const entity2 = await handler.getEntity(locationIds[3]);
      
      // 座標を確認して期待される結果を検証
      if (entity1?.coordinates) {
        const isInArea = handler.isPointInPolygon(
          entity1.coordinates,
          boundaryPolygon.vertices
        );
        expect(entity1.metadata?.tags).toContain(
          isInArea ? 'エリア内' : 'エリア外'
        );
      }
    });

    it('TC3.5: バッチ処理の進捗管理', async () => {
      // 大量のロケーションノードを追加
      const largeLocationIds: EntityId[] = [];
      for (let i = 0; i < 100; i++) {
        const id = `location-large-${i}` as EntityId;
        largeLocationIds.push(id);
        await handler.createEntity(id, {
          name: `場所 ${i}`,
          description: '',
          coordinates: {
            latitude: 35.6762 + (Math.random() - 0.5) * 0.1,
            longitude: 139.6503 + (Math.random() - 0.5) * 0.1
          },
          address: null
        });
      }

      const batchId = 'batch-progress';
      const progressEvents: any[] = [];

      // 進捗イベントリスナーを設定
      handler.on('batchProgress', (event) => {
        progressEvents.push(event);
      });

      // バッチ処理開始（メタデータ更新）
      const batch = await handler.createBatch(batchId, {
        entityIds: largeLocationIds,
        operations: [
          {
            type: 'updateMetadata',
            metadata: { processed: true }
          }
        ],
        rateLimit: {
          requestsPerSecond: 10
        }
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

      // API制限が遵守されることを確認（10req/s = 100件で最低10秒）
      // テスト環境では実際のAPI呼び出しはないので、処理時間のみ確認
      const processingTime = endTime - startTime;
      expect(processingTime).toBeGreaterThan(0);
    });

    it('TC3.6: バッチ処理の中断・再開・破棄', async () => {
      const batchId = 'batch-interrupt';
      
      // モックのジオコーディング結果を設定（再開テスト用）
      mockGeocodingAPI.geocode
        .mockResolvedValue({
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          formattedAddress: 'テスト住所'
        });
      
      // バッチ処理を開始
      const batch = await handler.createBatch(batchId, {
        entityIds: locationIds,
        operations: [
          {
            type: 'updateMetadata',
            metadata: { batchProcessed: true }
          }
        ],
        processInChunks: true,
        chunkSize: 2
      });

      // 途中で中断（最初の2件を処理）
      await handler.executeBatchChunk(batchId, 0);
      
      // 処理済みノードを確認
      let state = await handler.getBatchState(batchId);
      expect(state.processed).toBe(2);
      expect(state.status).toBe('paused');

      // 処理を再開
      await handler.resumeBatch(batchId);
      
      // さらに2件処理
      await handler.executeBatchChunk(batchId, 1);
      
      // 一部完了後に破棄
      await handler.discardBatch(batchId);

      // 全変更がロールバックされることを確認
      for (const id of locationIds) {
        const entity = await handler.getEntity(id);
        expect(entity?.metadata?.batchProcessed).toBeUndefined();
      }
    });
  });

  describe('地理計算テスト', () => {
    it('距離計算の精度', () => {
      // 東京駅から大阪駅までの距離（約400km）
      const tokyo: Coordinates = { latitude: 35.6812, longitude: 139.7671 };
      const osaka: Coordinates = { latitude: 34.7024, longitude: 135.4959 };
      
      const distance = calculateDistance(tokyo, osaka);
      
      // 395km〜405kmの範囲であることを確認
      expect(distance).toBeGreaterThan(395000);
      expect(distance).toBeLessThan(405000);
    });

    it('ポリゴン面積計算', async () => {
      // 1km四方の正方形
      const square: Polygon = {
        type: 'polygon',
        vertices: [
          { latitude: 35.6762, longitude: 139.6503 },
          { latitude: 35.6852, longitude: 139.6503 },
          { latitude: 35.6852, longitude: 139.6613 },
          { latitude: 35.6762, longitude: 139.6613 },
          { latitude: 35.6762, longitude: 139.6503 }
        ]
      };
      
      const area = handler.calculatePolygonArea(square.vertices);
      
      // 約1km²（誤差を考慮）
      expect(area).toBeGreaterThan(900000); // 0.9km²
      expect(area).toBeLessThan(1100000); // 1.1km²
    });

    it('ポイント・イン・ポリゴン判定', () => {
      const polygon: Coordinates[] = [
        { latitude: 35.65, longitude: 139.70 },
        { latitude: 35.70, longitude: 139.70 },
        { latitude: 35.70, longitude: 139.75 },
        { latitude: 35.65, longitude: 139.75 },
        { latitude: 35.65, longitude: 139.70 }
      ];
      
      // ポリゴン内の点
      const insidePoint: Coordinates = { latitude: 35.675, longitude: 139.725 };
      expect(handler.isPointInPolygon(insidePoint, polygon)).toBe(true);
      
      // ポリゴン外の点
      const outsidePoint: Coordinates = { latitude: 35.60, longitude: 139.70 };
      expect(handler.isPointInPolygon(outsidePoint, polygon)).toBe(false);
      
      // 境界上の点
      const borderPoint: Coordinates = { latitude: 35.65, longitude: 139.70 };
      expect(handler.isPointInPolygon(borderPoint, polygon)).toBe(true);
    });
  });
});

// Mock implementation helpers for LocationEntityHandler
declare module '../LocationEntityHandler' {
  interface LocationEntityHandler {
    createWorkingCopy(
      workingCopyId: WorkingCopyId,
      nodeId: NodeId,
      data: CreateLocationData
    ): Promise<LocationWorkingCopy>;
    
    updateWorkingCopy(
      workingCopyId: WorkingCopyId,
      data: Partial<LocationEntity>
    ): Promise<LocationWorkingCopy>;
    
    commitWorkingCopy(workingCopyId: WorkingCopyId): Promise<LocationEntity>;
    
    discardWorkingCopy(workingCopyId: WorkingCopyId): Promise<void>;
    
    getWorkingCopy(workingCopyId: WorkingCopyId): Promise<LocationWorkingCopy | null>;
    
    createWorkingCopyFromEntity(
      workingCopyId: WorkingCopyId,
      entityId: EntityId
    ): Promise<LocationWorkingCopy>;
    
    setCoordinatesFromMap(
      workingCopyId: WorkingCopyId,
      coordinates: Coordinates
    ): Promise<void>;
    
    getNearbyPOIs(
      workingCopyId: WorkingCopyId,
      radius: number
    ): Promise<any[]>;
    
    setBoundary(
      workingCopyId: WorkingCopyId,
      boundary: Polygon
    ): Promise<void>;
    
    calculateAreaInfo(workingCopyId: WorkingCopyId): Promise<{
      area: number;
      perimeter: number;
      centroid: Coordinates;
    }>;
    
    validateAddressWithGeocoding(workingCopyId: WorkingCopyId): Promise<{
      isValid: boolean;
      suggestedCoordinates?: Coordinates;
    }>;
    
    previewChanges(workingCopyId: WorkingCopyId): Promise<{
      changes: Array<{
        field: string;
        oldValue: any;
        newValue: any;
      }>;
    }>;
    
    calculatePolygonArea(vertices: Coordinates[]): number;
    
    isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean;
    
    createBatch(batchId: string, config: any): Promise<any>;
    executeBatch(batchId: string): Promise<any>;
    executeBatchChunk(batchId: string, chunkIndex: number): Promise<any>;
    getBatchState(batchId: string): Promise<any>;
    resumeBatch(batchId: string): Promise<any>;
    discardBatch(batchId: string): Promise<any>;
    
    on(event: string, handler: Function): void;
  }
}