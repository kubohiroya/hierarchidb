/**
  * @file test-shape-plugin-entity-data.ts
 * @description Test fixture data for Shape plugin integration tests
  * ShapeEntity:
 * - : geoBoundaries
 * - : (JPN), (DEU), (USA)
 * - Admin Level: 0 ()
 * - :
  */

// Minimal type definitions for standalone testing
type NodeId = string & { readonly __brand: 'NodeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

interface ShapeEntity {
  id: EntityId;
  nodeId: NodeId;
  dataSourceName: string;
  licenseAgreement: boolean;
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: boolean[][];
  urlMetadata?: UrlMetadata[];
}

interface BatchConfig {
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
    minZoom: number;
    maxZoom: number;
  };
}

interface UrlMetadata {
  url: string;
  countryCode: string;
  adminLevel: number;
  continent: string;
  dataSource?: string;
}

/**
  * NodeIdEntityId
  */
export const TEST_NODE_ID = 'test-shape-plugin-node-jpu-deu-usa' as NodeId;
export const TEST_ENTITY_ID = 'test-shape-plugin-entity-jpu-deu-usa' as EntityId;

/**
  * 3Level 0BatchConfig
  */
export function createTestBatchConfig(): BatchConfig {
  // Default configuration without external dependencies

  return {
    dataSource: 'geoboundaries',
    download: {
      concurrentDownloads: 2,
      deleteOnComplete: false,
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
      deleteOnComplete: false,
    },
    simplify2: {
      concurrentProcesses: 2,
      quantize: 1e5,
      simplify: 0.005,
      tolerance: 0.05,
      enablePerFeatureSimplification: true,
      deleteOnComplete: false,
    },
    vectorTiles: {
      concurrentProcesses: 2,
      minZoom: 0,
      maxZoom: 10,
    },
  };
}

/**
  * ShapeEntity - 3Level 0
  */
export function createTestShapeEntity(): ShapeEntity {
  return {
    id: TEST_ENTITY_ID,
    nodeId: TEST_NODE_ID,
    dataSourceName: 'geoboundaries',
    licenseAgreement: true,
    batchConfig: createTestBatchConfig(),
    selectedArrayByCountries: [
      [true],
      [true],
      [true],
    ],
    urlMetadata: [
      { url: 'https://example.com/jpn/adm0', countryCode: 'JPN', adminLevel: 0, continent: 'AS', dataSource: 'geoboundaries' },
      { url: 'https://example.com/deu/adm0', countryCode: 'DEU', adminLevel: 0, continent: 'EU', dataSource: 'geoboundaries' },
      { url: 'https://example.com/usa/adm0', countryCode: 'USA', adminLevel: 0, continent: 'NA', dataSource: 'geoboundaries' },
    ],
  };
}

/**
  * ShapeEntity -
  */
export function createTestShapeEntityJapanOnly(): ShapeEntity {
  const baseEntity = createTestShapeEntity();

  return {
    ...baseEntity,
    id: 'test-shape-plugin-entity-jpn-only' as EntityId,
    nodeId: 'test-shape-plugin-node-jpn-only' as NodeId,
    selectedArrayByCountries: [[true]],
    urlMetadata: [
      { url: 'https://example.com/jpn/adm0', countryCode: 'JPN', adminLevel: 0, continent: 'AS', dataSource: 'geoboundaries' },
    ],
    batchConfig: {
      ...baseEntity.batchConfig!,
      simplify2: {
        ...baseEntity.batchConfig!.simplify2,
        quantize: 1e4, simplify: 0.01,
      },
      vectorTiles: {
        ...baseEntity.batchConfig!.vectorTiles,
        maxZoom: 8,
      },
    },
  };
}

/**
     */
export const EXPECTED_BATCH_RESULTS = {
  //  3 Level 0
  threeCountries: {
    downloadStage: {
      expectedFiles: 3, //  JPN, DEU, USA1
      expectedTotalFeatures: 3, //  1
      expectedDataSources: ['geoboundaries'],
    },
    simplify1Stage: {
      expectedProcessedFeatures: 3,
      expectedFilteredFeatures: 3,
    },
    simplify2Stage: {
      expectedSimplifiedFeatures: 3,
      maxToleranceDeviation: 0.1,
    },
    vectorTilesStage: {
      expectedMinTiles: 1, //  1
      expectedMaxTiles: 100, //  100zoom level 10
      expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
  },

  japanOnly: {
    downloadStage: {
      expectedFiles: 1,
      expectedTotalFeatures: 1,
      expectedDataSources: ['geoboundaries'],
    },
    simplify1Stage: {
      expectedProcessedFeatures: 1,
      expectedFilteredFeatures: 1,
    },
    simplify2Stage: {
      expectedSimplifiedFeatures: 1,
      maxToleranceDeviation: 0.1,
    },
    vectorTilesStage: {
      expectedMinTiles: 1,
      expectedMaxTiles: 50, expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    },
  },
};

/**
  * geoBoundaries API
 * API
  */
export const GEOBOUNDARIES_TEST_ENDPOINTS = {
  metadata: 'https://www.geoboundaries.org/api/current/gbOpen/',
  download: {
    JPN: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/JPN/ADM0/geoBoundaries-JPN-ADM0.geojson',
    DEU: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/DEU/ADM0/geoBoundaries-DEU-ADM0.geojson',
    USA: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/USA/ADM0/geoBoundaries-USA-ADM0.geojson',
  },
};

/**
    */
export const TEST_TIMEOUTS = {
  download: 30000,    //  30 -
  simplify1: 60000,   //  60 -
  simplify2: 60000,   //  60 -
  vectorTiles: 90000, //  90 -
  fullWorkflow: 300000, //  5 -
};
