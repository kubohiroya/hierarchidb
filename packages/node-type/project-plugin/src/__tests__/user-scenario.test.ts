import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
import type { ProjectEntity, ProjectCategory } from '../types/project-types';
import { projectDB } from '../database/project-database';

describe('Project Plugin ユーザシナリオテスト', () => {
  let handler: ProjectEntityHandler;
  
  beforeEach(async () => {
    handler = new ProjectEntityHandler();
    await projectDB.open();
  });
  
  afterEach(async () => {
    await projectDB.delete();
  });

  describe('シナリオ1: プロジェクト作成', () => {
    it('テストケース1.1: 基本プロジェクト作成', async () => {
      // Given
      const nodeId = 'test-project-node-1' as NodeId;
      const basicInfo = {
        name: '東京都市再開発プロジェクト',
        description: '渋谷エリアの都市再開発計画',
        category: 'urban-planning' as ProjectCategory,
        tags: ['tokyo', 'urban-planning', 'redevelopment'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2026-12-31'),
        milestones: [
          {
            date: new Date('2024-06-30'),
            name: '基本設計完了',
            description: '基本設計フェーズの完了'
          }
        ]
      };

      // When
      const entity = await handler.createEntity(nodeId, basicInfo);

      // Then
      expect(entity).toBeDefined();
      expect(entity.name).toBe(basicInfo.name);
      expect(entity.category).toBe(basicInfo.category);
      expect(entity.tags).toEqual(basicInfo.tags);
      expect(entity.milestones).toHaveLength(1);
      expect(entity.version).toBe(1);
      
      const retrieved = await handler.getEntity(nodeId);
      expect(retrieved).toEqual(entity);
    });

    it('テストケース1.2: 複数レイヤーでのプロジェクト初期化', async () => {
      // Given
      const nodeId = 'test-project-node-2' as NodeId;
      const layerConfig = {
        layers: [
          {
            id: 'shape-layer-1',
            name: '建物データ',
            source: {
              nodeId: 'shape-node-1' as NodeId,
              nodeType: 'shape' as const,
              nodeName: '建物ポリゴン',
              lastUpdated: new Date(),
              recordCount: 150
            },
            config: { enabled: true, order: 1, opacity: 0.8 },
            style: { type: 'simple' as const, polygon: { fillColor: '#ff0000', fillOpacity: 0.5, strokeColor: '#000000', strokeWidth: 1 } },
            interaction: { hoverable: true, clickable: true, selectable: true, editable: false }
          },
          {
            id: 'location-layer-1',
            name: '重要施設',
            source: {
              nodeId: 'location-node-1' as NodeId,
              nodeType: 'location' as const,
              nodeName: '病院・学校',
              lastUpdated: new Date(),
              recordCount: 25
            },
            config: { enabled: true, order: 2, opacity: 1.0 },
            style: { type: 'simple' as const, point: { symbol: 'circle', size: 8, color: '#00ff00' } },
            interaction: { hoverable: true, clickable: true, selectable: false, editable: false }
          }
        ],
        layerGroups: [
          {
            id: 'base-data',
            name: '基礎データ',
            layers: ['shape-layer-1', 'location-layer-1']
          }
        ]
      };

      // When
      const entity = await handler.createEntity(nodeId, layerConfig);

      // Then
      expect(entity.layers).toHaveLength(2);
      expect(entity.layerGroups).toHaveLength(1);
      expect(entity.layers[0].name).toBe('建物データ');
      expect(entity.layers[1].source.nodeType).toBe('location');
      expect(entity.layerGroups[0].layers).toContain('shape-layer-1');
    });

    it('テストケース1.3: 時系列プロジェクト作成', async () => {
      // Given
      const nodeId = 'test-project-node-3' as NodeId;
      const temporalConfig = {
        temporalAnalyses: [
          {
            id: 'trend-1',
            name: '人口変化トレンド',
            type: 'trend' as const,
            trend: {
              layer: 'population-layer',
              valueField: 'population',
              aggregation: 'mean' as const,
              interval: 'monthly',
              trendLine: 'linear' as const
            }
          }
        ]
      };

      // When
      const entity = await handler.createEntity(nodeId, temporalConfig);

      // Then
      expect(entity.temporalAnalyses).toHaveLength(1);
      expect(entity.temporalAnalyses[0].type).toBe('trend');
      expect(entity.temporalAnalyses[0].trend?.valueField).toBe('population');
    });
  });

  describe('シナリオ2: プロジェクト編集', () => {
    let existingNodeId: NodeId;

    beforeEach(async () => {
      existingNodeId = 'existing-project' as NodeId;
      await handler.createEntity(existingNodeId, {
        name: '既存プロジェクト',
        category: 'research' as ProjectCategory
      });
    });

    it('テストケース2.1: 空間解析設定編集（WorkingCopyパターン）', async () => {
      // Given - WorkingCopyを作成
      const workingCopy = await handler.createWorkingCopy(existingNodeId);
      
      // When - バッファ解析を追加
      workingCopy.spatialAnalyses.push({
        id: 'buffer-1',
        name: '500m バッファ解析',
        type: 'buffer',
        buffer: {
          sourceLayer: 'buildings',
          distance: 500,
          unit: 'meters',
          dissolve: true,
          endCap: 'round'
        },
        output: {
          name: 'buffer-results',
          saveAsLayer: true,
          style: {
            type: 'simple',
            polygon: {
              fillColor: '#0088ff',
              fillOpacity: 0.3,
              strokeColor: '#004488',
              strokeWidth: 2
            }
          }
        },
        execution: {
          auto: false
        }
      });
      workingCopy.isDirty = true;
      
      // Then - WorkingCopyをコミット
      await handler.commitWorkingCopy(existingNodeId, workingCopy);
      
      const updated = await handler.getEntity(existingNodeId);
      expect(updated?.spatialAnalyses).toHaveLength(1);
      expect(updated?.spatialAnalyses[0].name).toBe('500m バッファ解析');
      expect(updated?.spatialAnalyses[0].buffer?.distance).toBe(500);
    });

    it('テストケース2.2: レポート設定編集', async () => {
      // Given
      const workingCopy = await handler.createWorkingCopy(existingNodeId);
      
      // When - レポート設定を更新
      workingCopy.outputConfig.report = {
        enabled: true,
        format: 'pdf',
        sections: [
          { type: 'title', content: { title: 'プロジェクト分析レポート' } },
          { type: 'map', content: { layers: ['all'], scale: '1:10000' } },
          { type: 'chart', content: { type: 'bar', data: 'analysis-results' } }
        ],
        template: {
          id: 'standard-template',
          headerFooter: true,
          tableOfContents: true
        },
        schedule: {
          frequency: 'weekly',
          time: '09:00',
          recipients: ['project-manager@example.com']
        }
      };
      workingCopy.isDirty = true;

      // Then
      await handler.commitWorkingCopy(existingNodeId, workingCopy);
      
      const updated = await handler.getEntity(existingNodeId);
      expect(updated?.outputConfig.report.enabled).toBe(true);
      expect(updated?.outputConfig.report.sections).toHaveLength(3);
      expect(updated?.outputConfig.report.schedule?.frequency).toBe('weekly');
    });

    it('テストケース2.3: コラボレーター管理', async () => {
      // Given
      const workingCopy = await handler.createWorkingCopy(existingNodeId);

      // When - コラボレーターを追加
      workingCopy.collaborators = [
        { email: 'analyst@example.com', role: 'editor' },
        { email: 'viewer@example.com', role: 'viewer' }
      ];
      workingCopy.permissions = [
        { userId: 'user-123', level: 'write' },
        { userId: 'user-456', level: 'read' }
      ];
      workingCopy.visibility = 'team';
      workingCopy.isDirty = true;

      // Then
      await handler.commitWorkingCopy(existingNodeId, workingCopy);
      
      const updated = await handler.getEntity(existingNodeId);
      expect(updated?.collaborators).toHaveLength(2);
      expect(updated?.permissions).toHaveLength(2);
      expect(updated?.visibility).toBe('team');
      expect(updated?.collaborators[0].email).toBe('analyst@example.com');
    });
  });

  describe('シナリオ3: バッチ処理', () => {
    it('テストケース3.1: 複数プロジェクト作成', async () => {
      // Given - テンプレート設定
      const template = {
        category: 'urban-planning' as ProjectCategory,
        tags: ['batch-created', 'template'],
        coverage: {
          type: 'bbox' as const,
          bbox: { minLon: 139.0, minLat: 35.0, maxLon: 140.0, maxLat: 36.0 }
        },
        outputConfig: {
          report: { enabled: true, format: 'pdf' as const, sections: [] },
          tiles: { enabled: false, format: 'pmtiles' as const, config: { minZoom: 0, maxZoom: 14, layers: [], optimization: { simplification: true, compression: 'gzip' as const, tileSize: 512 as const } } },
          export: { formats: [], packaging: 'zip' as const },
          sharing: { permissions: { download: true, print: true, edit: false } }
        }
      };

      const projectNames = [
        '渋谷再開発A',
        '新宿再開発B',
        '池袋再開発C',
        '品川再開発D',
        '上野再開発E'
      ];

      // When - バッチ作成
      const createdProjects: ProjectEntity[] = [];
      for (let i = 0; i < projectNames.length; i++) {
        const nodeId = `batch-project-${i + 1}` as NodeId;
        const project = await handler.createEntity(nodeId, {
          ...template,
          name: projectNames[i],
          description: `${projectNames[i]}の都市再開発プロジェクト`
        });
        createdProjects.push(project);
      }

      // Then
      expect(createdProjects).toHaveLength(5);
      createdProjects.forEach((project, index) => {
        expect(project.name).toBe(projectNames[index]);
        expect(project.category).toBe('urban-planning');
        expect(project.tags).toContain('batch-created');
        expect(project.outputConfig.report.enabled).toBe(true);
      });

      // 全プロジェクトが作成されたことを確認
      const allProjects = await handler.list({ tags: ['batch-created'] });
      expect(allProjects).toHaveLength(5);
    });

    it('テストケース3.2: 分析バッチ実行', async () => {
      // Given - 3つのプロジェクトを準備
      const projectIds = [];
      for (let i = 1; i <= 3; i++) {
        const nodeId = `analysis-project-${i}` as NodeId;
        await handler.createEntity(nodeId, {
          name: `分析プロジェクト${i}`,
          category: 'research' as ProjectCategory
        });
        projectIds.push(nodeId);
      }

      // When - 各プロジェクトに空間解析を追加
      const analysisResults = [];
      for (const projectId of projectIds) {
        const workingCopy = await handler.createWorkingCopy(projectId);
        
        workingCopy.spatialAnalyses.push({
          id: `nearest-${projectId}`,
          name: '最近隣解析',
          type: 'nearest',
          nearest: {
            fromLayer: 'points-layer',
            toLayer: 'facilities-layer',
            k: 3,
            maxDistance: 1000,
            outputLines: true
          },
          output: {
            name: `nearest-results-${projectId}`,
            saveAsLayer: true
          },
          execution: {
            auto: true
          }
        });
        workingCopy.isDirty = true;

        await handler.commitWorkingCopy(projectId, workingCopy);
        const updated = await handler.getEntity(projectId);
        analysisResults.push(updated);
      }

      // Then
      expect(analysisResults).toHaveLength(3);
      analysisResults.forEach((project, index) => {
        expect(project?.spatialAnalyses).toHaveLength(1);
        expect(project?.spatialAnalyses[0].type).toBe('nearest');
        expect(project?.spatialAnalyses[0].execution.auto).toBe(true);
      });
    });

    it('テストケース3.3: プロジェクト一括削除', async () => {
      // Given - 削除対象のプロジェクトを作成
      const deleteTargets = [];
      for (let i = 1; i <= 3; i++) {
        const nodeId = `delete-target-${i}` as NodeId;
        await handler.createEntity(nodeId, {
          name: `削除対象プロジェクト${i}`,
          category: 'research' as ProjectCategory,
          tags: ['delete-me']
        });
        deleteTargets.push(nodeId);
      }

      // 保持すべきプロジェクトも作成
      const keepNodeId = 'keep-project' as NodeId;
      await handler.createEntity(keepNodeId, {
        name: '保持プロジェクト',
        category: 'research' as ProjectCategory,
        tags: ['keep-me']
      });

      // When - 条件に合うプロジェクトを検索して削除
      const projectsToDelete = await handler.list({ tags: ['delete-me'] });
      expect(projectsToDelete).toHaveLength(3);

      for (const project of projectsToDelete) {
        await handler.deleteEntity(project.nodeId);
      }

      // Then - 削除確認
      for (const nodeId of deleteTargets) {
        const deleted = await handler.getEntity(nodeId);
        expect(deleted).toBeUndefined();
      }

      // 保持すべきプロジェクトは残っていることを確認
      const kept = await handler.getEntity(keepNodeId);
      expect(kept).toBeDefined();
      expect(kept?.name).toBe('保持プロジェクト');

      // 全体の確認
      const remainingProjects = await handler.list();
      expect(remainingProjects.every(p => !p.tags.includes('delete-me'))).toBe(true);
    });
  });

  describe('技術的検証', () => {
    it('WorkingCopyパターンの動作確認', async () => {
      // Given
      const nodeId = 'working-copy-test' as NodeId;
      await handler.createEntity(nodeId, {
        name: 'Original Project',
        description: 'Original description'
      });

      // When - WorkingCopyを作成して変更
      const workingCopy = await handler.createWorkingCopy(nodeId);
      expect(workingCopy.isWorkingCopy).toBe(true);
      expect(workingCopy.isDirty).toBe(false);

      workingCopy.description = 'Modified description';
      workingCopy.isDirty = true;

      // Then - 元のエンティティは変更されていない
      const original = await handler.getEntity(nodeId);
      expect(original?.description).toBe('Original description');

      // WorkingCopyをコミット
      await handler.commitWorkingCopy(nodeId, workingCopy);
      
      const committed = await handler.getEntity(nodeId);
      expect(committed?.description).toBe('Modified description');
      expect(committed?.version).toBe(2); // バージョンが上がる
    });

    it('バリデーション機能の確認', async () => {
      // 有効なデータ
      const validData = {
        name: 'Valid Project',
        coverage: {
          type: 'bbox' as const,
          bbox: { minLon: 139.0, minLat: 35.0, maxLon: 140.0, maxLat: 36.0 }
        },
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      let result = await handler.validate(validData);
      expect(result.valid).toBe(true);

      // 無効なデータ
      const invalidData = {
        name: '',  // 空の名前
        coverage: {
          type: 'bbox' as const,
          bbox: { minLon: 140.0, minLat: 36.0, maxLon: 139.0, maxLat: 35.0 }  // 逆転したbbox
        },
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01')  // 開始日より前の終了日
      };

      result = await handler.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Project name is required');
      expect(result.errors).toContain('Invalid bounding box: minLon must be less than maxLon');
      expect(result.errors).toContain('End date must be after start date');
    });
  });
});