/**
  * @file test-shape-plugin-entity-data.ts
 * @description Test fixture data for Shape plugin integration tests
  * ShapeEntity:
 * - : geoBoundaries
 * - : (JP), (DE), (US)
 * - Admin Level: 0 ()
 * - :
  */

// Minimal type definitions for standalone testing
type NodeId = string & { readonly __brand: 'NodeId' };
type EntityId = string & { readonly __brand: 'EntityId' };

interface ShapeEntity {
  id: EntityId;
  nodeId: NodeId;
  licenseAgreement: boolean;
  batchConfig?: BatchConfig;
  selectedArrayByCountries?: Record<string, boolean[]>;
}

interface BatchConfig {
  dataSource?: string;
  download: {
    concurrentDownloads: number;
    deleteOnComplete?: boolean;
  };
  extract1: {
    concurrentProcesses: number;
    enableFeatureFiltering: boolean;
    featureAreaThreshold: number;
    minVertexCountForAreaFilter: number;
    aspectRatioThreshold: number;
    featureFilterMethod: string;
    hybridFilterConfig?: any;
    deleteOnComplete?: boolean;
  };
  extract2: {
    concurrentProcesses: number;
    quantize: number;
    extract: number;
    tolerance: number;
    enablePerFeatureExtraction: boolean;
    deleteOnComplete?: boolean;
  };
  vectorTiles: {
    concurrentProcesses: number;
  };
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
    extract1: {
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
    extract2: {
      concurrentProcesses: 2,
      quantize: 1e5,
      extract: 0.005,
      tolerance: 0.05,
      enablePerFeatureExtraction: true,
      deleteOnComplete: false,
    },
    vectorTiles: {
      concurrentProcesses: 2,
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
    licenseAgreement: true,
    batchConfig: createTestBatchConfig(),
    selectedArrayByCountries: {
      JP: [true],
      DE: [true],
      US: [true],
    },
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
    selectedArrayByCountries: { JP: [true] },
    batchConfig: {
      ...baseEntity.batchConfig!,
      extract2: {
        ...baseEntity.batchConfig!.extract2,
        quantize: 1e4, extract: 0.01,
      },
      vectorTiles: {
        ...baseEntity.batchConfig!.vectorTiles,
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
    extract1Stage: {
      expectedProcessedFeatures: 3,
      expectedFilteredFeatures: 3,
    },
    extract2Stage: {
      expectedExtractedFeatures: 3,
      maxToleranceDeviation: 0.1,
    },
    vectorTilesStage: {
      expectedMinTiles: 1, //  1
      expectedMaxTiles: 100, //  100zoom level 11
      expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
  },

  japanOnly: {
    downloadStage: {
      expectedFiles: 1,
      expectedTotalFeatures: 1,
      expectedDataSources: ['geoboundaries'],
    },
    extract1Stage: {
      expectedProcessedFeatures: 1,
      expectedFilteredFeatures: 1,
    },
    extract2Stage: {
      expectedExtractedFeatures: 1,
      maxToleranceDeviation: 0.1,
    },
    vectorTilesStage: {
      expectedMinTiles: 1,
      expectedMaxTiles: 50,
      expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
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
  extract1: 60000,   //  60 -
  extract2: 60000,   //  60 -
  vectorTiles: 90000, //  90 -
  fullWorkflow: 300000, //  5 -
};
