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
  buildConfig?: BatchConfig;
  selectedArrayByCountries?: Record<string, boolean[]>;
}

interface BatchConfig {
  dataSourceName?: string;
  fetchConfig: {
    maxConcurrent: number;
    deleteOnComplete?: boolean;
  };
  transformConfig: {
    maxConcurrent: number;
    enableFeatureFiltering: boolean;
    featureAreaThreshold: number;
    minVertexCountForAreaFilter: number;
    aspectRatioThreshold: number;
    featureFilterMethod: string;
    hybridFilterConfig?: any;
    deleteOnComplete?: boolean;
    quantize: number;
    tolerance: number;
  };
  vtConfig: {
    maxConcurrent: number;
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
    dataSourceName: 'geoboundaries',
    fetchConfig: {
      maxConcurrent: 2,
      deleteOnComplete: false,
    },
    transformConfig: {
      maxConcurrent: 2,
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
      quantize: 1e5,
      tolerance: 0.05,
    },
    vtConfig: {
      maxConcurrent: 2,
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
    buildConfig: createTestBatchConfig(),
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
    buildConfig: {
      ...baseEntity.buildConfig!,
      transformConfig: {
        ...baseEntity.buildConfig!.transformConfig,
        quantize: 1e4,
      },
      vtConfig: {
        ...baseEntity.buildConfig!.vtConfig,
      },
    },
  };
}

/**
     */
export const EXPECTED_BATCH_RESULTS = {
  //  3 Level 0
  threeCountries: {
    fetchStage: {
      expectedFiles: 3, //  JPN, DEU, USA1
      expectedTotalFeatures: 3, //  1
      expectedDataSources: ['geoboundaries'],
    },
    transformStage: {
      expectedTransformedFeatures: 3,
    },
    vtStage: {
      expectedMinTiles: 1, //  1
      expectedMaxTiles: 100, //  100zoom level 11
      expectedZoomLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
  },

  japanOnly: {
    fetchStage: {
      expectedFiles: 1,
      expectedTotalFeatures: 1,
      expectedDataSources: ['geoboundaries'],
    },
    transformStage: {
      expectedTransformedFeatures: 1,
    },
    vtStage: {
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
  metadata: 'https://geoboundaries.org/api/current/gbOpen/',
  download: {
    JPN: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/JPN/ADM0/geoBoundaries-JPN-ADM0.geojson',
    DEU: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/DEU/ADM0/geoBoundaries-DEU-ADM0.geojson',
    USA: 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/USA/ADM0/geoBoundaries-USA-ADM0.geojson',
  },
};

/**
    */
export const TEST_TIMEOUTS = {
  fetch: 30000,    //  30 -
  transform: 60000,   //  60 -
  vt: 90000, //  90 -
  fullWorkflow: 300000, //  5 -
};
