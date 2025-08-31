import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { RouteEntityHandler } from '../entities/RouteEntityHandler';
import type { 
  RouteEntity, 
  RouteWorkingCopy, 
  TransportMode,
  RouteGenerationMethod,
  RoutePoint
} from '../entities/RouteEntity';
import { RouteDatabase } from '../database/RouteDatabase';

// Mock外部サービス
vi.mock('../services/RouteGenerator');
vi.mock('../services/LocationResolver');

describe('Route Plugin ユーザシナリオテスト', () => {
  let handler: RouteEntityHandler;
  let routeDB: RouteDatabase;
  
  beforeEach(async () => {
    handler = new RouteEntityHandler();
    routeDB = new RouteDatabase();
    await routeDB.open();
  });
  
  afterEach(async () => {
    await routeDB.delete();
  });

  describe('シナリオ1: 経路作成', () => {
    it('テストケース1.1: 基本経路作成（直線接続）', async () => {
      // Given
      const nodeId = 'test-route-node-1' as NodeId;
      const routeData = {
        name: '東京-大阪幹線',
        description: '東京駅から大阪駅への直行路線',
        category: { primary: 'rail' as TransportMode },
        transportMode: 'rail' as TransportMode,
        operator: 'JR東海',
        routeNumber: 'T001',
        startPoint: {
          coordinates: [139.7673068, 35.6809591] as [number, number], // 東京駅
          name: '東京駅',
          type: 'custom' as const
        },
        endPoint: {
          coordinates: [135.4959506, 34.7024854] as [number, number], // 大阪駅
          name: '大阪駅',
          type: 'custom' as const
        },
        generationMethod: 'direct' as RouteGenerationMethod
      };

      // When
      const entity = await handler.createEntity(nodeId, routeData);

      // Then
      expect(entity).toBeDefined();
      expect(entity.name).toBe(routeData.name);
      expect(entity.transportMode).toBe('rail');
      expect(entity.operator).toBe('JR東海');
      expect(entity.lineGeometry).toHaveLength(2); // 直線なので開始・終了の2点
      expect(entity.distance).toBeGreaterThan(0); // 距離が計算されている
      expect(entity.processingStatus).toBe('completed');
      
      const retrieved = await handler.getEntity(entity.id);
      expect(retrieved).toEqual(entity);
    });

    it('テストケース1.2: ウェイポイント経由の経路作成', async () => {
      // Given
      const nodeId = 'test-route-node-2' as NodeId;
      const waypointRoute = {
        name: '環状線',
        description: '主要駅を結ぶ環状路線',
        category: { primary: 'rail' as TransportMode },
        transportMode: 'rail' as TransportMode,
        startLocationId: 'location-tokyo' as NodeId, // Location plugin参照
        endLocationId: 'location-shimbashi' as NodeId,
        waypoints: [
          {
            coordinates: [139.7412, 35.6598] as [number, number], // 品川
            name: '品川駅',
            type: 'custom' as const
          },
          {
            coordinates: [139.7307, 35.6256] as [number, number], // 田町
            name: '田町駅',
            type: 'custom' as const
          }
        ] as RoutePoint[],
        generationMethod: 'osm_route' as RouteGenerationMethod,
        frequency: {
          type: 'scheduled' as const,
          schedule: '*/5 * * * *', // 5分間隔
          averageInterval: 5
        }
      };

      // When
      const entity = await handler.createEntity(nodeId, waypointRoute);

      // Then
      expect(entity.name).toBe('環状線');
      expect(entity.waypoints).toHaveLength(2);
      expect(entity.frequency?.averageInterval).toBe(5);
      expect(entity.lineGeometry.length).toBeGreaterThan(4); // ウェイポイント経由でより多くの点
      expect(entity.generationMethod).toBe('osm_route');
    });

    it('テストケース1.3: 交通モード別経路作成', async () => {
      // Given - 航空路の作成
      const airRouteId = 'air-route' as NodeId;
      const airRoute = {
        name: 'HND-KIX航路',
        transportMode: 'air' as TransportMode,
        category: { primary: 'air' as TransportMode },
        operator: 'Japan Airlines',
        routeNumber: 'JL117',
        startPoint: {
          coordinates: [139.7798, 35.5494] as [number, number], // 羽田空港
          name: '羽田空港',
          type: 'custom' as const
        },
        endPoint: {
          coordinates: [135.2379, 34.4273] as [number, number], // 関西国際空港
          name: '関西国際空港',
          type: 'custom' as const
        },
        generationMethod: 'great_circle' as RouteGenerationMethod,
        frequency: {
          type: 'scheduled' as const,
          averageInterval: 60 // 1時間間隔
        }
      };

      // When
      const airEntity = await handler.createEntity(airRouteId, airRoute);

      // Then
      expect(airEntity.transportMode).toBe('air');
      expect(airEntity.generationMethod).toBe('great_circle');
      expect(airEntity.frequency?.averageInterval).toBe(60);

      // Given - パイプライン経路の作成
      const pipelineId = 'pipeline-route' as NodeId;
      const pipeline = {
        name: 'LNG輸送管',
        transportMode: 'pipeline' as TransportMode,
        category: { primary: 'pipeline' as TransportMode, secondary: 'lng' },
        operator: '東京ガス',
        generationMethod: 'direct' as RouteGenerationMethod,
        style: {
          color: '#FFB000',
          width: 8,
          opacity: 0.8,
          dashArray: [10, 5]
        }
      };

      const pipelineEntity = await handler.createEntity(pipelineId, pipeline);
      expect(pipelineEntity.transportMode).toBe('pipeline');
      expect(pipelineEntity.style?.color).toBe('#FFB000');
      expect(pipelineEntity.category.secondary).toBe('lng');
    });
  });

  describe('シナリオ2: 経路編集', () => {
    let existingRouteId: EntityId;
    let existingNodeId: NodeId;

    beforeEach(async () => {
      existingNodeId = 'existing-route' as NodeId;
      const route = await handler.createEntity(existingNodeId, {
        name: '既存経路',
        transportMode: 'road' as TransportMode,
        category: { primary: 'road' as TransportMode },
        generationMethod: 'direct' as RouteGenerationMethod,
        startPoint: {
          coordinates: [139.7, 35.6] as [number, number],
          name: 'Start',
          type: 'custom' as const
        },
        endPoint: {
          coordinates: [139.8, 35.7] as [number, number],
          name: 'End', 
          type: 'custom' as const
        }
      });
      existingRouteId = route.id;
    });

    it('テストケース2.1: 経路最適化（WorkingCopyパターン）', async () => {
      // Given - WorkingCopyを作成
      const entity = await handler.getEntity(existingRouteId);
      expect(entity).toBeDefined();
      
      const workingCopy: RouteWorkingCopy = {
        ...entity!,
        isDraft: true,
        copiedAt: Date.now(),
        originalVersion: entity!.version
      };

      // When - ウェイポイントを追加して最適化
      workingCopy.waypoints = [
        {
          coordinates: [139.75, 35.65] as [number, number],
          name: '経由地A',
          type: 'custom' as const
        },
        {
          coordinates: [139.77, 35.68] as [number, number],
          name: '経由地B',
          type: 'custom' as const
        }
      ];
      workingCopy.transportMode = 'cycling'; // 交通モードも変更
      workingCopy.modifiedFields = ['waypoints', 'transportMode'];

      // Then - WorkingCopyの変更を適用
      const updated = await handler.updateEntity(existingRouteId, workingCopy);
      expect(updated.waypoints).toHaveLength(2);
      expect(updated.transportMode).toBe('cycling');
      expect(updated.version).toBeGreaterThan(entity!.version);
      expect(updated.distance).toBeDefined(); // 距離が再計算されている
    });

    it('テストケース2.2: 経路スタイル設定編集', async () => {
      // Given
      const entity = await handler.getEntity(existingRouteId);
      
      // When - スタイル設定を更新
      const styleUpdates = {
        style: {
          color: '#FF4444',
          width: 6,
          opacity: 0.9,
          dashArray: [20, 10, 5, 10],
          animate: true
        },
        name: '強調表示経路'
      };

      const updated = await handler.updateEntity(existingRouteId, styleUpdates);

      // Then
      expect(updated.style?.color).toBe('#FF4444');
      expect(updated.style?.width).toBe(6);
      expect(updated.style?.dashArray).toEqual([20, 10, 5, 10]);
      expect(updated.style?.animate).toBe(true);
      expect(updated.name).toBe('強調表示経路');
    });

    it('テストケース2.3: 運行情報更新', async () => {
      // Given
      const operationalUpdates = {
        frequency: {
          type: 'scheduled' as const,
          schedule: '0 */2 * * *', // 2時間間隔
          averageInterval: 120
        },
        operator: '新運行会社',
        routeNumber: 'R-001-UPDATED',
        description: '運行スケジュール変更済み'
      };

      // When
      const updated = await handler.updateEntity(existingRouteId, operationalUpdates);

      // Then
      expect(updated.frequency?.schedule).toBe('0 */2 * * *');
      expect(updated.frequency?.averageInterval).toBe(120);
      expect(updated.operator).toBe('新運行会社');
      expect(updated.routeNumber).toBe('R-001-UPDATED');
      expect(updated.description).toContain('運行スケジュール変更済み');
    });
  });

  describe('シナリオ3: バッチ処理', () => {
    it('テストケース3.1: 交通ネットワーク一括生成', async () => {
      // Given - 主要拠点の定義
      const majorStations = [
        { id: 'tokyo' as NodeId, name: '東京駅', coords: [139.7673, 35.6810] },
        { id: 'shinjuku' as NodeId, name: '新宿駅', coords: [139.7006, 35.6896] },
        { id: 'shibuya' as NodeId, name: '渋谷駅', coords: [139.7016, 35.6581] },
        { id: 'ikebukuro' as NodeId, name: '池袋駅', coords: [139.7111, 35.7298] }
      ];

      // When - 全対全経路を生成（鉄道とバス）
      const routeConfigs = [];
      for (let i = 0; i < majorStations.length; i++) {
        for (let j = i + 1; j < majorStations.length; j++) {
          const start = majorStations[i];
          const end = majorStations[j];
          
          // 鉄道路線
          routeConfigs.push({
            nodeId: `rail-${start.id}-${end.id}` as NodeId,
            data: {
              name: `${start.name}-${end.name}線`,
              transportMode: 'rail' as TransportMode,
              category: { primary: 'rail' as TransportMode },
              startPoint: {
                coordinates: start.coords as [number, number],
                name: start.name,
                type: 'custom' as const
              },
              endPoint: {
                coordinates: end.coords as [number, number],
                name: end.name,
                type: 'custom' as const
              },
              generationMethod: 'osm_route' as RouteGenerationMethod
            }
          });

          // バス路線
          routeConfigs.push({
            nodeId: `bus-${start.id}-${end.id}` as NodeId,
            data: {
              name: `${start.name}-${end.name}バス`,
              transportMode: 'road' as TransportMode,
              category: { primary: 'road' as TransportMode, secondary: 'bus' },
              startPoint: {
                coordinates: start.coords as [number, number],
                name: start.name,
                type: 'custom' as const
              },
              endPoint: {
                coordinates: end.coords as [number, number],
                name: end.name,
                type: 'custom' as const
              },
              generationMethod: 'osm_route' as RouteGenerationMethod
            }
          });
        }
      }

      const generatedRoutes = await handler.batchGenerateRoutes(routeConfigs);

      // Then
      expect(generatedRoutes).toHaveLength(routeConfigs.length);
      
      const railRoutes = generatedRoutes.filter(r => r.transportMode === 'rail');
      const busRoutes = generatedRoutes.filter(r => r.category.secondary === 'bus');
      
      expect(railRoutes).toHaveLength(6); // 4拠点の組み合わせ = C(4,2) = 6
      expect(busRoutes).toHaveLength(6);
      
      // 全経路が処理完了していることを確認
      expect(generatedRoutes.every(r => r.processingStatus === 'completed')).toBe(true);
    });

    it('テストケース3.2: 経路統計と分析', async () => {
      // Given - 複数種類の経路を準備
      const routeTypes: Array<{mode: TransportMode, count: number}> = [
        { mode: 'rail', count: 3 },
        { mode: 'road', count: 5 },
        { mode: 'air', count: 2 },
        { mode: 'sea', count: 1 }
      ];

      for (const routeType of routeTypes) {
        for (let i = 0; i < routeType.count; i++) {
          await handler.createEntity(`${routeType.mode}-${i}` as NodeId, {
            name: `${routeType.mode}経路${i}`,
            transportMode: routeType.mode,
            category: { primary: routeType.mode },
            distance: Math.random() * 10000 + 1000, // 1-11km
            generationMethod: 'direct' as RouteGenerationMethod,
            startPoint: {
              coordinates: [139.7, 35.6] as [number, number],
              name: 'Start',
              type: 'custom' as const
            },
            endPoint: {
              coordinates: [139.8, 35.7] as [number, number],
              name: 'End',
              type: 'custom' as const
            }
          });
        }
      }

      // When - 統計情報を取得
      const statistics = await handler.getStatistics();

      // Then
      expect(statistics.totalRoutes).toBe(11); // 3+5+2+1
      expect(statistics.byTransportMode.rail).toBe(3);
      expect(statistics.byTransportMode.road).toBe(5);
      expect(statistics.byTransportMode.air).toBe(2);
      expect(statistics.byTransportMode.sea).toBe(1);
      
      expect(statistics.totalDistance).toBeGreaterThan(0);
      expect(statistics.averageDistance).toBeGreaterThan(0);
      expect(statistics.processingStats.completed).toBe(11);
    });

    it('テストケース3.3: 経路データのクリーンアップ', async () => {
      // Given - テスト用データを作成（重複経路含む）
      const testRoutes = [];
      
      // 重複経路を作成
      for (let i = 0; i < 3; i++) {
        const route = await handler.createEntity(`duplicate-${i}` as NodeId, {
          name: '重複経路',
          transportMode: 'road' as TransportMode,
          category: { primary: 'road' as TransportMode },
          startPoint: {
            coordinates: [139.7, 35.6] as [number, number],
            name: 'Same Start',
            type: 'custom' as const
          },
          endPoint: {
            coordinates: [139.8, 35.7] as [number, number],
            name: 'Same End',
            type: 'custom' as const
          },
          generationMethod: 'direct' as RouteGenerationMethod
        });
        testRoutes.push(route);
      }

      // 保持すべき経路
      const keepRoute = await handler.createEntity('keep-route' as NodeId, {
        name: '保持経路',
        transportMode: 'rail' as TransportMode,
        category: { primary: 'rail' as TransportMode },
        generationMethod: 'direct' as RouteGenerationMethod
      });

      // When - 重複経路の検出と削除（同じ起終点の経路を削除）
      const allRoutes = await routeDB.routes.toArray();
      const duplicates = allRoutes.filter(route => 
        route.name === '重複経路' &&
        route.startPoint?.name === 'Same Start' &&
        route.endPoint?.name === 'Same End'
      );

      expect(duplicates).toHaveLength(3);

      // 最初の1つを残して、残りを削除
      for (let i = 1; i < duplicates.length; i++) {
        await handler.deleteEntity(duplicates[i].id);
      }

      // Then - クリーンアップ結果を確認
      const remainingRoutes = await routeDB.routes.toArray();
      const remainingDuplicates = remainingRoutes.filter(r => r.name === '重複経路');
      
      expect(remainingDuplicates).toHaveLength(1); // 1つだけ残っている
      
      // 保持すべき経路は残っている
      const preserved = await handler.getEntity(keepRoute.id);
      expect(preserved).toBeDefined();
      expect(preserved?.name).toBe('保持経路');

      // 全体の数を確認
      expect(remainingRoutes).toHaveLength(2); // 重複1つ + 保持1つ
    });
  });

  describe('技術的検証', () => {
    it('Location plugin連携の動作確認', async () => {
      // Given - Location参照を含む経路
      const nodeId = 'location-ref-route' as NodeId;
      const routeWithLocationRefs = {
        name: 'Location参照経路',
        transportMode: 'rail' as TransportMode,
        category: { primary: 'rail' as TransportMode },
        startLocationId: 'location-ref-1' as NodeId,
        endLocationId: 'location-ref-2' as NodeId,
        generationMethod: 'direct' as RouteGenerationMethod
      };

      // When
      const entity = await handler.createEntity(nodeId, routeWithLocationRefs);

      // Then - Location参照が保持されている
      expect(entity.startLocationId).toBe('location-ref-1');
      expect(entity.endLocationId).toBe('location-ref-2');
      
      // LocationResolverが呼ばれていることを確認（モックなので実際の座標解決はなし）
      expect(entity.startPoint).toBeDefined();
      expect(entity.endPoint).toBeDefined();
    });

    it('経路生成アルゴリズムの精度検証', async () => {
      // Given - 異なる生成方法での同一区間経路
      const baseRoute = {
        name: 'アルゴリズム比較',
        transportMode: 'road' as TransportMode,
        category: { primary: 'road' as TransportMode },
        startPoint: {
          coordinates: [139.7673, 35.6810] as [number, number],
          name: 'Tokyo',
          type: 'custom' as const
        },
        endPoint: {
          coordinates: [139.7006, 35.6896] as [number, number],
          name: 'Shinjuku',
          type: 'custom' as const
        }
      };

      // When - 異なる生成方法で経路作成
      const directRoute = await handler.createEntity('direct-algo' as NodeId, {
        ...baseRoute,
        generationMethod: 'direct' as RouteGenerationMethod
      });

      const osmRoute = await handler.createEntity('osm-algo' as NodeId, {
        ...baseRoute,
        generationMethod: 'osm_route' as RouteGenerationMethod
      });

      // Then - アルゴリズムによる差異を確認
      expect(directRoute.lineGeometry).toHaveLength(2); // 直線は2点
      expect(osmRoute.lineGeometry.length).toBeGreaterThan(2); // OSMは複数点

      expect(directRoute.generationMethod).toBe('direct');
      expect(osmRoute.generationMethod).toBe('osm_route');
      
      // 距離の違い（OSMの方が一般的に長くなる）
      if (directRoute.distance && osmRoute.distance) {
        expect(osmRoute.distance).toBeGreaterThanOrEqual(directRoute.distance);
      }
    });

    it('経路ネットワーク連結性分析', async () => {
      // Given - 連結されたネットワークを構築
      const locations = [
        { id: 'hub-a' as NodeId, name: 'ハブA' },
        { id: 'hub-b' as NodeId, name: 'ハブB' },  
        { id: 'hub-c' as NodeId, name: 'ハブC' },
        { id: 'isolated' as NodeId, name: '孤立点' }
      ];

      // A-B, B-C の接続を作成（Aから Cまで間接的に到達可能）
      await handler.createEntity('route-a-b' as NodeId, {
        name: 'A-B接続',
        transportMode: 'road' as TransportMode,
        category: { primary: 'road' as TransportMode },
        startLocationId: 'hub-a' as NodeId,
        endLocationId: 'hub-b' as NodeId,
        generationMethod: 'direct' as RouteGenerationMethod
      });

      await handler.createEntity('route-b-c' as NodeId, {
        name: 'B-C接続',
        transportMode: 'road' as TransportMode,
        category: { primary: 'road' as TransportMode },
        startLocationId: 'hub-b' as NodeId,
        endLocationId: 'hub-c' as NodeId,
        generationMethod: 'direct' as RouteGenerationMethod
      });

      // When - 連結性を分析
      const connectedFromA = await handler.getConnectedRoutes('hub-a' as NodeId);
      const connectedFromB = await handler.getConnectedRoutes('hub-b' as NodeId);
      const connectedFromIsolated = await handler.getConnectedRoutes('isolated' as NodeId);

      // Then
      expect(connectedFromA.outgoing).toHaveLength(1); // A->B
      expect(connectedFromA.incoming).toHaveLength(0);
      
      expect(connectedFromB.incoming).toHaveLength(1); // A->B
      expect(connectedFromB.outgoing).toHaveLength(1); // B->C
      
      expect(connectedFromIsolated.outgoing).toHaveLength(0);
      expect(connectedFromIsolated.incoming).toHaveLength(0);
      expect(connectedFromIsolated.passing).toHaveLength(0);

      // 統計で連結性を確認
      const stats = await handler.getStatistics();
      expect(stats.connectedLocations).toBeGreaterThan(0);
    });
  });
});