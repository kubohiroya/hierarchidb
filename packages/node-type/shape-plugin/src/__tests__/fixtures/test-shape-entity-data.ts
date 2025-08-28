/**
 * @file test-shape-plugin-entity-data.ts
 * @description Test fixture data for Shape plugin integration tests
 * 
 * テスト用ShapeEntityデータ:
 * - データソース: geoBoundaries
 * - 対象国: 日本(JPN), ドイツ(DEU), アメリカ(USA)
 * - Admin Level: 0 (国境)
 * - バッチ設定: デフォルト値
 */

// Minimal type definitions for standalone testing
type NodeId = string & { readonly __brand: 'NodeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

interface ShapeEntity {
  id: EntityId;
  nodeId: NodeId;
  dataSourceName: string;
  selectedCountries: string[];
  selectedAdminLevels: number[];
  licenseAgreement: boolean;
  batchConfig?: BatchConfig;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface BatchConfig {
  corsProxyBaseURL: string;
  dataSource?: string;
  download: {
    concurrentDownloads: number;
    deleteOnComplete?: boolean;
  };
  simplify1: {
    concurrentProcesses: number;
    enableFeatureFiltering: boolean;
    featureAreaThreshold: number;
    minVertexCountForAreaFilter: number;
    aspectRatioThreshold: number;
    featureFilterMethod: string;
    hybridFilterConfig?: any;
    deleteOnComplete?: boolean;
  };
  simplify2: {
    concurrentProcesses: number;
    quantize: number;
    simplify: number;
    tolerance: number;
    enablePerFeatureSimplification: boolean;
    deleteOnComplete?: boolean;
  };
  vectorTiles: {
    concurrentProcesses: number;
    maxZoom: number;
    tileCountThresholdForZoomStop: number;
  };
}

/**
 * テスト用のNodeIdとEntityIdを生成
 */
export const TEST_NODE_ID = 'test-shape-plugin-node-jpu-deu-usa' as NodeId;
export const TEST_ENTITY_ID = 'test-shape-plugin-entity-jpu-deu-usa' as EntityId;

/**
 * 日独米3カ国Level 0用のデフォルトBatchConfig
 */
export function createTestBatchConfig(): BatchConfig {
  // Default configuration without external dependencies
  
  return {
    corsProxyBaseURL: 'https://test-proxy.example.com',
    dataSource: 'geoboundaries',
    download: {
      concurrentDownloads: 2,
      deleteOnComplete: false
    },
    simplify1: {
      concurrentProcesses: 2,
      enableFeatureFiltering: true,
      featureAreaThreshold: 0.05,
      minVertexCountForAreaFilter: 100,
      aspectRatioThreshold: 15,
      featureFilterMethod: 'hybrid',
      hybridFilterConfig: {
        quickRejectThreshold: 0.05,
        regularShapeMinRatio: 0.3,
        regularShapeMaxRatio: 3.0,
        simpleShapeVertexThreshold: 100,
        elongatedShapeCorrectionFactor: 0.7,
      },
      deleteOnComplete: false
    },
    simplify2: {
      concurrentProcesses: 2,
      quantize: 1e5,
      simplify: 0.005,
      tolerance: 0.05,
      enablePerFeatureSimplification: true,
      deleteOnComplete: false
    },
    vectorTiles: {
      concurrentProcesses: 2,
      maxZoom: 10,
      tileCountThresholdForZoomStop: 15000
    }
  };
}

/**
 * テスト用ShapeEntity - 日独米3カ国Level 0
 */
export function createTestShapeEntity(): ShapeEntity {
  const now = Date.now();
  
  return {
    id: TEST_ENTITY_ID,
    nodeId: TEST_NODE_ID,
    dataSourceName: 'geoboundaries',
    selectedCountries: [
      'JPN', // 日本
      'DEU', // ドイツ 
      'USA'  // アメリカ
    ],
    selectedAdminLevels: [0], // Level 0のみ（国境）
    licenseAgreement: true,
    batchConfig: createTestBatchConfig(),
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

/**
 * テスト用ShapeEntity - 日本のみ（軽量テスト用）
 */
export function createTestShapeEntityJapanOnly(): ShapeEntity {
  const baseEntity = createTestShapeEntity();
  
  return {
    ...baseEntity,
    id: 'test-shape-plugin-entity-jpn-only' as EntityId,
    nodeId: 'test-shape-plugin-node-jpn-only' as NodeId,
    selectedCountries: ['JPN'],
    // より軽量な設定
    batchConfig: {
      ...baseEntity.batchConfig!,
      simplify2: {
        ...baseEntity.batchConfig!.simplify2,
        quantize: 1e4, // 標準解像度に戻す
        simplify: 0.01 // 標準簡素化に戻す
      },
      vectorTiles: {
        ...baseEntity.batchConfig!.vectorTiles,
        maxZoom: 8 // 標準ズームレベルに戻す
      }
    }
  };
}

/**
 * バッチ処理期待値
 * 各段階での期待されるファイル数とデータ構造
 */
export const EXPECTED_BATCH_RESULTS = {
  // 3カ国 × Level 0
  threeCountries: {
    downloadStage: {
      expectedFiles: 3, // JPN, DEU, USA各1ファイル
      expectedTotalFeatures: 3, // 各国1つのフィーチャ
      expectedDataSources: ['geoboundaries']
    },
    simplify1Stage: {
      expectedProcessedFeatures: 3,
      expectedFilteredFeatures: 3, // フィルタリング後も全て保持
    },
    simplify2Stage: {
      expectedSimplifiedFeatures: 3,
      maxToleranceDeviation: 0.1 // 許容誤差範囲
    },
    vectorTilesStage: {
      expectedMinTiles: 1, // 最低1タイル
      expectedMaxTiles: 100, // 最大100タイル（zoom level 10まで）
      expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    }
  },
  
  // 日本のみ（軽量テスト）
  japanOnly: {
    downloadStage: {
      expectedFiles: 1,
      expectedTotalFeatures: 1,
      expectedDataSources: ['geoboundaries']
    },
    simplify1Stage: {
      expectedProcessedFeatures: 1,
      expectedFilteredFeatures: 1,
    },
    simplify2Stage: {
      expectedSimplifiedFeatures: 1,
      maxToleranceDeviation: 0.1
    },
    vectorTilesStage: {
      expectedMinTiles: 1,
      expectedMaxTiles: 50, // 日本のみなのでより少ない
      expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8]
    }
  }
};

/**
 * テスト用のgeoBoundaries APIエンドポイント情報
 * 実際のAPIレスポンス形式に基づいた期待値
 */
export const GEOBOUNDARIES_TEST_ENDPOINTS = {
  metadata: 'https://www.geoboundaries.org/api/current/gbOpen/',
  download: {
    JPN: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/JPN/ADM0/geoBoundaries-JPN-ADM0.geojson',
    DEU: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/DEU/ADM0/geoBoundaries-DEU-ADM0.geojson', 
    USA: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/USA/ADM0/geoBoundaries-USA-ADM0.geojson'
  }
};

/**
 * テスト実行時のタイムアウト設定
 */
export const TEST_TIMEOUTS = {
  download: 30000,    // 30秒 - ファイルダウンロード
  simplify1: 60000,   // 60秒 - 特徴量処理
  simplify2: 60000,   // 60秒 - 簡素化処理  
  vectorTiles: 90000, // 90秒 - ベクトルタイル生成
  fullWorkflow: 300000 // 5分 - 全体ワークフロー
};