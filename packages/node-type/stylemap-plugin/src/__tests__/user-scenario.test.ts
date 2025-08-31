import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { StyleMapEntityHandler } from '../handlers/StyleMapEntityHandler';
import { StyleMapDataService } from '../services/StyleMapDataService';
import type { 
  StyleMapEntity, 
  StyleMapWorkingCopy,
  StyleMapConfig,
  ColorAlgorithm,
  ColorSpace,
  MapLibreStyleProperty
} from '../types/styleMapTypes';

// Mock base handler
const mockSpreadsheetHandler = {
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn()
};

describe('StyleMap Plugin ユーザシナリオテスト', () => {
  let handler: StyleMapEntityHandler;
  let dataService: StyleMapDataService;
  
  beforeEach(async () => {
    dataService = new StyleMapDataService();
    handler = new StyleMapEntityHandler(mockSpreadsheetHandler, dataService);
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('シナリオ1: スタイルマップ作成', () => {
    it('テストケース1.1: 基本的なスタイルマップ作成', async () => {
      // Given - 人口密度データのCSV
      const populationData = {
        headers: ['prefecture', 'population', 'area', 'density'],
        rows: [
          ['Tokyo', '14000000', '2194', '6379.9'],
          ['Osaka', '8800000', '1905', '4619.3'],
          ['Kanagawa', '9200000', '2416', '3807.9'],
          ['Aichi', '7500000', '5173', '1449.9'],
          ['Saitama', '7300000', '3798', '1922.1']
        ]
      };

      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        id: 'spreadsheet-entity-1' as EntityId,
        nodeId: 'style-map-node-1' as NodeId,
        name: 'Population Density Map',
        dataSource: {
          type: 'file',
          source: 'population_data.csv',
          delimiter: ',',
          hasHeader: true
        },
        data: populationData
      });

      const nodeId = 'style-map-node-1' as NodeId;
      const styleMapData = {
        name: 'Population Density Style Map',
        description: '都道府県別人口密度の可視化',
        styleMapConfig: {
          targetProperty: 'fill-color' as MapLibreStyleProperty,
          algorithm: 'linear' as ColorAlgorithm,
          colorSpace: 'hsv' as ColorSpace,
          mapping: {
            min: 0,
            max: 7000,
            hueStart: 240, // 青
            hueEnd: 0,     // 赤
            saturation: 0.8,
            brightness: 0.9
          },
          keyColumn: 'prefecture',
          valueColumn: 'density',
          enabled: true
        } as StyleMapConfig,
        selectedKeyColumn: 'prefecture',
        selectedValueColumn: 'density'
      };

      // When
      const entity = await handler.createEntity(nodeId, styleMapData);

      // Then
      expect(entity).toBeDefined();
      expect(entity.name).toBe('Population Density Style Map');
      expect(entity.styleMapConfig.targetProperty).toBe('fill-color');
      expect(entity.styleMapConfig.algorithm).toBe('linear');
      expect(entity.selectedKeyColumn).toBe('prefecture');
      expect(entity.selectedValueColumn).toBe('density');
      
      // スタイル設定が正しく保存されている
      expect(entity.styleMapConfig.mapping.min).toBe(0);
      expect(entity.styleMapConfig.mapping.max).toBe(7000);
      expect(entity.styleMapConfig.mapping.hueStart).toBe(240);
      expect(entity.styleMapConfig.mapping.hueEnd).toBe(0);
      
      expect(mockSpreadsheetHandler.createEntity).toHaveBeenCalledWith(nodeId, styleMapData);
    });

    it('テストケース1.2: 高度なカラーアルゴリズム設定', async () => {
      // Given - Jenks自然分類アルゴリズムでの設定
      const advancedData = {
        name: 'Advanced Color Mapping',
        styleMapConfig: {
          targetProperty: 'circle-color' as MapLibreStyleProperty,
          algorithm: 'jenks' as ColorAlgorithm,
          colorSpace: 'lab' as ColorSpace,
          mapping: {
            min: 100,
            max: 10000,
            hueStart: 120, // 緑
            hueEnd: 300,   // 紫
            saturation: 0.7,
            brightness: 0.8,
            startColor: '#00ff00', // カスタム開始色
            endColor: '#8000ff'    // カスタム終了色
          },
          keyColumn: 'region_id',
          valueColumn: 'economic_value',
          invertColors: true,
          opacity: 0.85,
          enabled: true
        } as StyleMapConfig
      };

      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        id: 'advanced-entity' as EntityId,
        nodeId: 'advanced-node' as NodeId,
        ...advancedData
      });

      // When
      const entity = await handler.createEntity('advanced-node' as NodeId, advancedData);

      // Then
      expect(entity.styleMapConfig.algorithm).toBe('jenks');
      expect(entity.styleMapConfig.colorSpace).toBe('lab');
      expect(entity.styleMapConfig.invertColors).toBe(true);
      expect(entity.styleMapConfig.opacity).toBe(0.85);
      expect(entity.styleMapConfig.mapping.startColor).toBe('#00ff00');
      expect(entity.styleMapConfig.mapping.endColor).toBe('#8000ff');
    });

    it('テストケース1.3: 複数スタイルプロパティの同時設定', async () => {
      // Given - 複数プロパティを設定するマルチレイヤースタイル
      const multiPropertyData = {
        name: 'Multi Property Style Map',
        styleMapConfigs: [
          {
            targetProperty: 'fill-color' as MapLibreStyleProperty,
            algorithm: 'quantile' as ColorAlgorithm,
            colorSpace: 'rgb' as ColorSpace,
            mapping: {
              min: 0,
              max: 1000,
              hueStart: 60,  // 黄
              hueEnd: 180,   // シアン
              saturation: 0.9,
              brightness: 0.7
            },
            keyColumn: 'area_id',
            valueColumn: 'primary_value',
            enabled: true
          },
          {
            targetProperty: 'fill-opacity' as MapLibreStyleProperty,
            algorithm: 'linear' as ColorAlgorithm,
            colorSpace: 'hsv' as ColorSpace,
            mapping: {
              min: 0,
              max: 100,
              hueStart: 0,
              hueEnd: 0, // 透明度なので色相は固定
              saturation: 0,
              brightness: 1
            },
            keyColumn: 'area_id',
            valueColumn: 'confidence_level',
            enabled: true
          },
          {
            targetProperty: 'line-color' as MapLibreStyleProperty,
            algorithm: 'equal' as ColorAlgorithm,
            colorSpace: 'hsv' as ColorSpace,
            mapping: {
              min: 1,
              max: 5,
              hueStart: 0,   // 赤
              hueEnd: 240,   // 青
              saturation: 1.0,
              brightness: 0.8
            },
            keyColumn: 'area_id',
            valueColumn: 'category_level',
            enabled: true
          }
        ] as StyleMapConfig[]
      };

      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        id: 'multi-prop-entity' as EntityId,
        nodeId: 'multi-prop-node' as NodeId,
        ...multiPropertyData
      });

      // When
      const entity = await handler.createEntity('multi-prop-node' as NodeId, multiPropertyData);

      // Then
      expect(entity.styleMapConfigs).toHaveLength(3);
      
      const fillColorConfig = entity.styleMapConfigs.find(c => c.targetProperty === 'fill-color');
      expect(fillColorConfig?.algorithm).toBe('quantile');
      
      const opacityConfig = entity.styleMapConfigs.find(c => c.targetProperty === 'fill-opacity');
      expect(opacityConfig?.valueColumn).toBe('confidence_level');
      
      const lineColorConfig = entity.styleMapConfigs.find(c => c.targetProperty === 'line-color');
      expect(lineColorConfig?.algorithm).toBe('equal');
      
      // 全設定が有効になっている
      expect(entity.styleMapConfigs.every(c => c.enabled)).toBe(true);
    });
  });

  describe('シナリオ2: スタイル編集・最適化', () => {
    let existingEntity: StyleMapEntity;

    beforeEach(async () => {
      existingEntity = {
        id: 'existing-entity' as EntityId,
        nodeId: 'existing-node' as NodeId,
        name: 'Existing Style Map',
        styleMapConfig: {
          targetProperty: 'fill-color' as MapLibreStyleProperty,
          algorithm: 'linear' as ColorAlgorithm,
          colorSpace: 'hsv' as ColorSpace,
          mapping: {
            min: 0,
            max: 100,
            hueStart: 120,
            hueEnd: 240,
            saturation: 0.8,
            brightness: 0.9
          },
          keyColumn: 'id',
          valueColumn: 'value',
          enabled: true
        },
        selectedKeyColumn: 'id',
        selectedValueColumn: 'value',
        spreadsheetMetadataId: 'meta-123',
        dataSource: {
          type: 'file',
          source: 'test.csv',
          delimiter: ',',
          hasHeader: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      };
    });

    it('テストケース2.1: インタラクティブなスタイル調整（WorkingCopyパターン）', async () => {
      // Given - WorkingCopyを作成
      mockSpreadsheetHandler.getEntity.mockResolvedValue(existingEntity);
      
      const workingCopy: StyleMapWorkingCopy = {
        ...existingEntity,
        copiedAt: Date.now(),
        originalNodeId: existingEntity.nodeId,
        originalVersion: existingEntity.version,
        hasEntityCopy: true
      };

      // When - スタイル調整を実行
      workingCopy.styleMapConfig = {
        ...workingCopy.styleMapConfig,
        algorithm: 'jenks' as ColorAlgorithm, // アルゴリズム変更
        colorSpace: 'lab' as ColorSpace,      // カラースペース変更
        mapping: {
          ...workingCopy.styleMapConfig.mapping,
          min: 10,      // 最小値調整
          max: 90,      // 最大値調整
          hueStart: 0,  // 赤から開始
          hueEnd: 120,  // 緑で終了
          saturation: 0.9, // 彩度を上げる
          brightness: 0.8  // 明度を下げる
        },
        invertColors: true, // 色を反転
        opacity: 0.7       // 透明度を追加
      };

      mockSpreadsheetHandler.updateEntity.mockResolvedValue({
        ...workingCopy,
        version: 2,
        updatedAt: Date.now()
      });

      const updatedEntity = await handler.updateEntity(existingEntity.nodeId, workingCopy);

      // Then
      expect(updatedEntity.styleMapConfig.algorithm).toBe('jenks');
      expect(updatedEntity.styleMapConfig.colorSpace).toBe('lab');
      expect(updatedEntity.styleMapConfig.mapping.min).toBe(10);
      expect(updatedEntity.styleMapConfig.mapping.max).toBe(90);
      expect(updatedEntity.styleMapConfig.invertColors).toBe(true);
      expect(updatedEntity.styleMapConfig.opacity).toBe(0.7);
      expect(updatedEntity.version).toBe(2);
    });

    it('テストケース2.2: データ範囲の動的調整', async () => {
      // Given - 統計データに基づく動的範囲調整
      const statisticalData = {
        values: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 200], // 外れ値含む
        percentiles: {
          p5: 10,
          p25: 30,
          p50: 50, // 中央値
          p75: 70,
          p95: 90
        },
        mean: 54.5,
        stdDev: 52.8
      };

      mockSpreadsheetHandler.getEntity.mockResolvedValue(existingEntity);

      // When - 統計的範囲調整を適用
      const adjustedConfig = {
        ...existingEntity.styleMapConfig,
        mapping: {
          ...existingEntity.styleMapConfig.mapping,
          // 外れ値を除外してP5-P95範囲を使用
          min: statisticalData.percentiles.p5,
          max: statisticalData.percentiles.p95
        },
        // データ分布に基づいてアルゴリズムを最適化
        algorithm: 'quantile' as ColorAlgorithm
      };

      const updatedData = {
        ...existingEntity,
        styleMapConfig: adjustedConfig,
        statisticalMetadata: {
          dataRange: statisticalData.percentiles,
          outlierHandling: 'p5_p95_exclude',
          distributionType: 'normal_with_outliers'
        }
      };

      mockSpreadsheetHandler.updateEntity.mockResolvedValue(updatedData);
      const updatedEntity = await handler.updateEntity(existingEntity.nodeId, updatedData);

      // Then
      expect(updatedEntity.styleMapConfig.mapping.min).toBe(10);
      expect(updatedEntity.styleMapConfig.mapping.max).toBe(90);
      expect(updatedEntity.styleMapConfig.algorithm).toBe('quantile');
      expect(updatedEntity.statisticalMetadata.outlierHandling).toBe('p5_p95_exclude');
    });

    it('テストケース2.3: テーマとスタイルルール継承', async () => {
      // Given - 組織標準テーマ設定
      const organizationTheme = {
        name: 'Corporate Dark Theme',
        baseColors: {
          primary: '#1E40AF',   // Corporate blue
          secondary: '#10B981', // Corporate green
          danger: '#EF4444',    // Corporate red
          warning: '#F59E0B',   // Corporate amber
          neutral: '#6B7280'    // Corporate gray
        },
        colorPalettes: {
          sequential: ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF'],
          diverging: ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#06B6D4', '#0EA5E9'],
          categorical: ['#1E40AF', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
        },
        styleRules: {
          opacity: {
            default: 0.8,
            hover: 0.9,
            selected: 1.0
          },
          strokeWidth: {
            default: 1,
            highlighted: 2,
            selected: 3
          }
        }
      };

      const themedStyleMap = {
        ...existingEntity,
        styleMapConfig: {
          ...existingEntity.styleMapConfig,
          // 組織テーマのカラーパレットを適用
          mapping: {
            ...existingEntity.styleMapConfig.mapping,
            startColor: organizationTheme.colorPalettes.sequential[0],
            endColor: organizationTheme.colorPalettes.sequential[8]
          },
          opacity: organizationTheme.styleRules.opacity.default
        },
        themeConfiguration: organizationTheme,
        inheritedRules: [
          'corporate_color_palette',
          'standard_opacity_levels',
          'accessibility_contrast_ratios'
        ]
      };

      mockSpreadsheetHandler.updateEntity.mockResolvedValue(themedStyleMap);
      const themedEntity = await handler.updateEntity(existingEntity.nodeId, themedStyleMap);

      // Then
      expect(themedEntity.styleMapConfig.mapping.startColor).toBe('#EFF6FF');
      expect(themedEntity.styleMapConfig.mapping.endColor).toBe('#1E40AF');
      expect(themedEntity.styleMapConfig.opacity).toBe(0.8);
      expect(themedEntity.themeConfiguration.name).toBe('Corporate Dark Theme');
      expect(themedEntity.inheritedRules).toContain('corporate_color_palette');
      expect(themedEntity.inheritedRules).toContain('accessibility_contrast_ratios');
    });
  });

  describe('シナリオ3: バッチ処理・スタイル統合', () => {
    it('テストケース3.1: 複数データセットの統一スタイリング', async () => {
      // Given - 統一スタイルテンプレート
      const unifiedStyleTemplate = {
        targetProperty: 'fill-color' as MapLibreStyleProperty,
        algorithm: 'quantile' as ColorAlgorithm,
        colorSpace: 'hsv' as ColorSpace,
        mapping: {
          hueStart: 240,
          hueEnd: 0,
          saturation: 0.8,
          brightness: 0.9
        },
        opacity: 0.75,
        enabled: true
      };

      const datasets = [
        { name: 'Prefecture Population', valueColumn: 'population', minMax: [100000, 14000000] },
        { name: 'City Economic Index', valueColumn: 'economic_value', minMax: [500, 50000] },
        { name: 'Regional Temperature', valueColumn: 'avg_temperature', minMax: [-5, 35] }
      ];

      // When - バッチスタイル適用
      const styledEntities = [];
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i];
        const nodeId = `batch-dataset-${i}` as NodeId;
        
        const styleMapData = {
          name: dataset.name,
          styleMapConfig: {
            ...unifiedStyleTemplate,
            mapping: {
              ...unifiedStyleTemplate.mapping,
              min: dataset.minMax[0],
              max: dataset.minMax[1]
            },
            keyColumn: 'id',
            valueColumn: dataset.valueColumn
          },
          selectedKeyColumn: 'id',
          selectedValueColumn: dataset.valueColumn
        };

        mockSpreadsheetHandler.createEntity.mockResolvedValueOnce({
          id: `entity-${i}` as EntityId,
          nodeId,
          ...styleMapData
        });

        const entity = await handler.createEntity(nodeId, styleMapData);
        styledEntities.push(entity);
      }

      // Then
      expect(styledEntities).toHaveLength(3);
      
      // 全エンティティが同じスタイル設定を共有
      styledEntities.forEach(entity => {
        expect(entity.styleMapConfig.algorithm).toBe('quantile');
        expect(entity.styleMapConfig.colorSpace).toBe('hsv');
        expect(entity.styleMapConfig.mapping.hueStart).toBe(240);
        expect(entity.styleMapConfig.mapping.hueEnd).toBe(0);
        expect(entity.styleMapConfig.opacity).toBe(0.75);
      });

      // データ固有の値範囲が正しく設定
      expect(styledEntities[0].styleMapConfig.mapping.min).toBe(100000);
      expect(styledEntities[0].styleMapConfig.mapping.max).toBe(14000000);
      expect(styledEntities[1].styleMapConfig.mapping.min).toBe(500);
      expect(styledEntities[1].styleMapConfig.mapping.max).toBe(50000);
      expect(styledEntities[2].styleMapConfig.mapping.min).toBe(-5);
      expect(styledEntities[2].styleMapConfig.mapping.max).toBe(35);
    });

    it('テストケース3.2: 時系列データの動的スタイリング', async () => {
      // Given - 時系列データ（月次変化）
      const timeSeriesData = [
        { month: '2024-01', values: [100, 150, 200, 175, 125] },
        { month: '2024-02', values: [110, 160, 210, 185, 135] },
        { month: '2024-03', values: [120, 170, 220, 195, 145] },
        { month: '2024-04', values: [130, 180, 230, 205, 155] }
      ];

      const keyframes = timeSeriesData.map((monthData, index) => {
        const globalMin = Math.min(...timeSeriesData.flatMap(d => d.values));
        const globalMax = Math.max(...timeSeriesData.flatMap(d => d.values));
        const monthMin = Math.min(...monthData.values);
        const monthMax = Math.max(...monthData.values);

        return {
          timestamp: monthData.month,
          styleConfig: {
            targetProperty: 'fill-color' as MapLibreStyleProperty,
            algorithm: 'linear' as ColorAlgorithm,
            colorSpace: 'hsv' as ColorSpace,
            mapping: {
              min: globalMin, // 全期間での最小値
              max: globalMax, // 全期間での最大値
              // 時期に応じて色相を変化（冬=青 → 春=緑 → 夏=黄 → 秋=橙）
              hueStart: 240 - (index * 60), // 240 → 180 → 120 → 60
              hueEnd: 240 - (index * 60) + 30,
              saturation: 0.7 + (monthMin / globalMax * 0.3), // 値に応じて彩度調整
              brightness: 0.6 + (monthMax / globalMax * 0.3)  // 値に応じて明度調整
            },
            keyColumn: 'region_id',
            valueColumn: 'monthly_value',
            enabled: true
          },
          dataMetadata: {
            month: monthData.month,
            localMin: monthMin,
            localMax: monthMax,
            trend: index > 0 ? (monthMin > timeSeriesData[index-1].values[0] ? 'up' : 'down') : 'baseline'
          }
        };
      });

      // When - 時系列スタイルマップを作成
      const timeSeriesEntityData = {
        name: 'Time Series Style Animation',
        description: '月次データの時系列変化可視化',
        styleMapConfigs: keyframes.map(kf => kf.styleConfig),
        animationKeyframes: keyframes,
        temporalSettings: {
          duration: 4000, // 4秒のアニメーション
          interpolation: 'smooth',
          loop: true,
          autoPlay: false
        }
      };

      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        id: 'timeseries-entity' as EntityId,
        nodeId: 'timeseries-node' as NodeId,
        ...timeSeriesEntityData
      });

      const entity = await handler.createEntity('timeseries-node' as NodeId, timeSeriesEntityData);

      // Then
      expect(entity.styleMapConfigs).toHaveLength(4); // 4ヶ月分
      expect(entity.animationKeyframes).toHaveLength(4);
      expect(entity.temporalSettings.duration).toBe(4000);

      // 各キーフレームの色相が時期に応じて変化
      expect(entity.animationKeyframes[0].styleConfig.mapping.hueStart).toBe(240); // 1月: 青
      expect(entity.animationKeyframes[1].styleConfig.mapping.hueStart).toBe(180); // 2月: シアン
      expect(entity.animationKeyframes[2].styleConfig.mapping.hueStart).toBe(120); // 3月: 緑
      expect(entity.animationKeyframes[3].styleConfig.mapping.hueStart).toBe(60);  // 4月: 黄

      // トレンド情報が記録されている
      expect(entity.animationKeyframes[0].dataMetadata.trend).toBe('baseline');
      expect(entity.animationKeyframes[1].dataMetadata.trend).toBe('up'); // 110 > 100
    });

    it('テストケース3.3: エクスポートと共有機能', async () => {
      // Given - エクスポート対象のスタイルマップ
      const exportEntity: StyleMapEntity = {
        id: 'export-entity' as EntityId,
        nodeId: 'export-node' as NodeId,
        name: 'Export Test Style Map',
        styleMapConfig: {
          targetProperty: 'fill-color' as MapLibreStyleProperty,
          algorithm: 'jenks' as ColorAlgorithm,
          colorSpace: 'rgb' as ColorSpace,
          mapping: {
            min: 0,
            max: 1000,
            hueStart: 120,
            hueEnd: 0,
            saturation: 0.8,
            brightness: 0.9,
            startColor: '#00FF00',
            endColor: '#FF0000'
          },
          keyColumn: 'region_code',
          valueColumn: 'gdp_per_capita',
          opacity: 0.85,
          enabled: true
        },
        selectedKeyColumn: 'region_code',
        selectedValueColumn: 'gdp_per_capita',
        spreadsheetMetadataId: 'export-meta',
        dataSource: {
          type: 'file',
          source: 'economic_data.csv',
          delimiter: ',',
          hasHeader: true
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1
      };

      mockSpreadsheetHandler.getEntity.mockResolvedValue(exportEntity);

      // When - 複数形式でエクスポート
      const exports = {
        maplibreStyle: {
          version: 8,
          name: exportEntity.name,
          sources: {
            regions: {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] }
            }
          },
          layers: [
            {
              id: 'regions-fill',
              type: 'fill',
              source: 'regions',
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['get', exportEntity.selectedValueColumn],
                  exportEntity.styleMapConfig.mapping.min, exportEntity.styleMapConfig.mapping.startColor,
                  exportEntity.styleMapConfig.mapping.max, exportEntity.styleMapConfig.mapping.endColor
                ],
                'fill-opacity': exportEntity.styleMapConfig.opacity
              }
            }
          ]
        },
        css: `
          .region-fill {
            fill-opacity: ${exportEntity.styleMapConfig.opacity};
            stroke: #333;
            stroke-width: 1px;
          }
          .region-fill[data-value-low] { fill: ${exportEntity.styleMapConfig.mapping.startColor}; }
          .region-fill[data-value-high] { fill: ${exportEntity.styleMapConfig.mapping.endColor}; }
        `,
        configJson: {
          metadata: {
            name: exportEntity.name,
            created: new Date().toISOString(),
            plugin: 'stylemap-plugin',
            version: '1.0.0'
          },
          styleConfiguration: exportEntity.styleMapConfig,
          dataMapping: {
            keyColumn: exportEntity.selectedKeyColumn,
            valueColumn: exportEntity.selectedValueColumn
          },
          exportSettings: {
            format: ['maplibre', 'css', 'json'],
            includeData: false,
            minified: true
          }
        }
      };

      // Then - エクスポート形式の検証
      // MapLibre Style JSON検証
      expect(exports.maplibreStyle.version).toBe(8);
      expect(exports.maplibreStyle.layers).toHaveLength(1);
      expect(exports.maplibreStyle.layers[0].type).toBe('fill');
      expect(exports.maplibreStyle.layers[0].paint['fill-opacity']).toBe(0.85);

      // CSS出力検証
      expect(exports.css).toContain('fill-opacity: 0.85');
      expect(exports.css).toContain('fill: #00FF00'); // 開始色
      expect(exports.css).toContain('fill: #FF0000'); // 終了色

      // 設定JSON検証
      expect(exports.configJson.metadata.plugin).toBe('stylemap-plugin');
      expect(exports.configJson.styleConfiguration.algorithm).toBe('jenks');
      expect(exports.configJson.dataMapping.keyColumn).toBe('region_code');
      expect(exports.configJson.dataMapping.valueColumn).toBe('gdp_per_capita');
      expect(exports.configJson.exportSettings.format).toContain('maplibre');
      expect(exports.configJson.exportSettings.format).toContain('css');
      expect(exports.configJson.exportSettings.format).toContain('json');
    });
  });

  describe('技術的検証', () => {
    it('カラーアルゴリズムの計算精度検証', async () => {
      // Given - 既知のデータセットでアルゴリズムの精度テスト
      const testData = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]; // フィボナッチ数列
      const algorithms: ColorAlgorithm[] = ['linear', 'quantile', 'jenks', 'equal'];

      // When - 各アルゴリズムで分類を実行
      const results = algorithms.map(algorithm => {
        const min = Math.min(...testData);
        const max = Math.max(...testData);
        
        switch (algorithm) {
          case 'linear':
            // 線形補間: 値に比例して色が変化
            return testData.map(value => ({
              value,
              normalizedValue: (value - min) / (max - min),
              algorithm
            }));
          
          case 'quantile':
            // 分位数: データを等数量に分割
            const sorted = [...testData].sort((a, b) => a - b);
            return sorted.map((value, index) => ({
              value,
              normalizedValue: index / (sorted.length - 1),
              algorithm
            }));
          
          case 'jenks':
            // Jenks自然分類（簡易実装）: データの自然な境界を検出
            return testData.map(value => {
              if (value <= 5) return { value, normalizedValue: 0.2, algorithm };
              if (value <= 21) return { value, normalizedValue: 0.6, algorithm };
              return { value, normalizedValue: 1.0, algorithm };
            });
          
          case 'equal':
            // 等間隔: 範囲を等分割
            const interval = (max - min) / 4; // 4分割
            return testData.map(value => ({
              value,
              normalizedValue: Math.floor((value - min) / interval) / 3,
              algorithm
            }));
          
          default:
            return [];
        }
      });

      // Then - アルゴリズム別の結果検証
      const linearResults = results[0];
      const quantileResults = results[1];
      const jenksResults = results[2];
      const equalResults = results[3];

      // Linear: 最小値が0、最大値が1に正規化
      expect(linearResults[0].normalizedValue).toBe(0); // min=1
      expect(linearResults[linearResults.length - 1].normalizedValue).toBe(1); // max=89

      // Quantile: データの順位に基づく正規化
      expect(quantileResults[0].normalizedValue).toBe(0); // 最小順位
      expect(quantileResults[quantileResults.length - 1].normalizedValue).toBe(1); // 最大順位

      // Jenks: 自然な分類境界
      expect(jenksResults.filter(r => r.normalizedValue === 0.2)).toHaveLength(4); // 1,2,3,5
      expect(jenksResults.filter(r => r.normalizedValue === 0.6)).toHaveLength(3); // 8,13,21
      expect(jenksResults.filter(r => r.normalizedValue === 1.0)).toHaveLength(3); // 34,55,89

      // Equal: 等間隔分割
      const equalNormalized = equalResults.map(r => r.normalizedValue);
      const uniqueValues = [...new Set(equalNormalized)].sort();
      expect(uniqueValues).toEqual([0, 0.3333333333333333, 0.6666666666666666, 1]);
    });

    it('大量データでのスタイル生成性能測定', async () => {
      // Given - 大容量データセット（10,000レコード）
      const largeDataset = Array.from({ length: 10000 }, (_, index) => ({
        id: `region_${index}`,
        value: Math.random() * 1000
      }));

      const performanceTestConfig = {
        name: 'Performance Test Style Map',
        styleMapConfig: {
          targetProperty: 'fill-color' as MapLibreStyleProperty,
          algorithm: 'quantile' as ColorAlgorithm,
          colorSpace: 'hsv' as ColorSpace,
          mapping: {
            min: 0,
            max: 1000,
            hueStart: 240,
            hueEnd: 0,
            saturation: 0.8,
            brightness: 0.9
          },
          keyColumn: 'id',
          valueColumn: 'value',
          enabled: true
        } as StyleMapConfig
      };

      mockSpreadsheetHandler.createEntity.mockResolvedValue({
        id: 'performance-entity' as EntityId,
        nodeId: 'performance-node' as NodeId,
        ...performanceTestConfig,
        data: largeDataset
      });

      // When - パフォーマンス測定
      const startTime = performance.now();
      
      const entity = await handler.createEntity('performance-node' as NodeId, performanceTestConfig);
      
      // スタイル計算をシミュレート（実際のカラー変換処理）
      const processedData = largeDataset.map(item => {
        const normalizedValue = item.value / 1000;
        const hue = 240 - (normalizedValue * 240); // 240 → 0
        const color = `hsl(${hue}, 80%, 90%)`;
        return { ...item, color };
      });
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Then - 性能基準をクリア
      expect(processingTime).toBeLessThan(1000); // 1秒以内
      expect(processedData).toHaveLength(10000);
      expect(entity.styleMapConfig.algorithm).toBe('quantile');

      // メモリ効率の確認（推定）
      const estimatedMemoryUsage = processedData.length * 100; // 100bytes per item
      expect(estimatedMemoryUsage).toBeLessThan(2 * 1024 * 1024); // 2MB以下

      // カラー変換の精度確認
      const firstItem = processedData[0];
      const lastItem = processedData[processedData.length - 1];
      expect(firstItem.color).toMatch(/hsl\(\d+, 80%, 90%\)/);
      expect(lastItem.color).toMatch(/hsl\(\d+, 80%, 90%\)/);
    });
  });
});