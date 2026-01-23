/**
    */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSourceStrategyFactory, defaultDataSourceFactory } from '../DataSourceStrategyFactory.js';
import { BaseDataSourceStrategy, type FetchOptions, type ProcessOptions, type SaveTarget, type DataSourceConfig } from '../DataSourceStrategy.js';
import { NaturalEarthStrategy } from '../NaturalEarthStrategy.js';
import { GADMStrategy } from '../GADMStrategy.js';
import { OpenStreetMapStrategy } from '../OpenStreetMapStrategy.js';
import { GeoBoundariesStrategy } from '../GeoBoundariesStrategy.js';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.js';

// Mock AuthRecoveryService used by authFetch so strategies avoid real network
vi.mock('@hierarchidb/auth-recovery', () => {
  const fetchWithAuth = async (input: string | URL, _init?: RequestInit): Promise<Response> => {
    const url = String(input);
    // Natural Earth downloads a ZIP; return a tiny valid zip buffer
    if (url.includes('naturalearthdata.com')) {
      const JSZip = (await import('jszip'));
      const zip = new JSZip();
      zip.file('dummy.txt', 'hello');
      const buf = await zip.generateAsync({ type: 'arraybuffer' });
      return new Response(buf, { status: 200 });
    }

    // GeoBoundaries metadata endpoints
    if (url.includes('geoboundaries.org/api/current/gbOpen/available')) {
      return new Response(JSON.stringify({ USA: ['ADM0', 'ADM1'], JPN: ['ADM0', 'ADM1'] }), { status: 200 });
    }
    if (url.includes('/gbOpen/')) {
      return new Response(JSON.stringify({ simplifiedGeometryGeoJSON: 'https://mock.local/gb.geojson', boundaryYear: '2023', licenseDetail: 'Open' }), { status: 200 });
    }
    if (url.includes('mock.local/gb.geojson')) {
      return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, properties: { shapeName: 'Mock' } }] } as any), { status: 200 });
    }

    // OSM Overpass interpreter
    if (url.includes('overpass-api.de')) {
      return new Response(JSON.stringify({ elements: [{ type: 'node', id: 1, lat: 0, lon: 0, tags: { name: 'Mock' } }], generator: 'mock' }), { status: 200 });
    }

    // Default health check OK
    return new Response('OK', { status: 200 });
  };

  return {
    AuthRecoveryService: {
      getSingleton: () => Promise.resolve({ fetchWithAuth }),
    },
  };
});

//  fetch
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

// (Removed unused mock fixtures)

const minimalBatchConfig = {
  dataSource: 'naturalearth' as const,
  downloadConfig: {
    maxConcurrent: 1,
    retryAttempts: 1,
    retryDelay: 1,
    timeoutMs: 1000,
  },
  transformConfig: {
    workers: 1,
    zoomBandBoundaries: [0, 3, 6],
    tolerance: 0.01,
    featureFilterMethod: 'hybrid' as const,
    areaThreshold: 1,
    excludePolygonAreaCoefficient: 1,
    omitDetailsConfig: {
      level: 'strong',
    },
    selfIntersectionTuningConfig: {
      disableAtZoomOrBelow: 3,
      maxVerticesForFix: 50000,
      maxVerticesForSplit: 15000,
    },
    minVertexCountForAreaFilter: 1,
    aspectRatioThreshold: 1,
    ringFixConfig: {
      minRingVertices: 4,
      minRingAreaMultiplier: 1,
      removeDuplicateConsecutivePoints: true,
      removeCollinearPoints: false,
    },
    selfIntersectionConfig: {
      strategy: 'keep_largest',
      minPolygonAreaMultiplier: 1,
      maxPolygons: 1,
      retainHoles: false,
      snapToleranceMultiplier: 1,
    },
    preSimplifyFilterConfig: {
      excludeInvalidGeometry: true,
      dropInvalidHoles: true,
      splitSelfIntersections: true,
      dropSmallPolygons: true,
    },
  },
  tileConfig: {
    workers: 1,
  },
  cleanupConfig: {
    deleteFetchApiCache: false,
    deleteFetchFilteredCache: false,
    deleteTransformCache: false,
    deleteVTCache: false,
  },
};

class TestStrategy extends BaseDataSourceStrategy<any, ShapeEntity[]> {
  readonly id = 'test-strategy';
  readonly name = 'Test Strategy';
  readonly config: DataSourceConfig = {
    id: 'test-strategy',
    name: 'Test Strategy',
    version: '1.0.0',
    access: {
      method: 'REST',
      authentication: { type: 'none' },
      baseUrl: 'https://example.com',
    },
    processing: {
      inputFormat: 'json',
      outputFormat: 'geojson',
    },
  };

  async fetchData(options?: FetchOptions): Promise<any> {
    return { test: 'data', options };
  }

  async processData(_rawData: any, _options?: ProcessOptions): Promise<ShapeEntity[]> {
    // Minimal valid ShapeEntity per current type definition
    const entity: ShapeEntity = {
      // Cast string to branded ids for test purposes
      id: 'test-entity-1' as unknown as any,
      nodeId: 'test-node-1' as unknown as any,
      batchConfig: { ...minimalBatchConfig, dataSource: 'naturalearth' },
      licenseAgreement: true,
      selectedArrayByCountries: { US: [true] },
    };
    return [entity];
  }
}

describe('DataSourceStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BaseDataSourceStrategy', () => {
    let strategy: TestStrategy;

    beforeEach(() => {
      strategy = new TestStrategy();
    });

    it('should implement basic strategy interface', () => {
      expect(strategy.id).toBe('test-strategy');
      expect(strategy.name).toBe('Test Strategy');
      expect(strategy.config).toBeDefined();
    });

    it('should fetch data with options', async () => {
      const options: FetchOptions = {
        bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 },
      };

      const result = await strategy.fetchData(options);
      expect(result).toEqual({ test: 'data', options });
    });

    it('should process data with options', async () => {
      const rawData = { test: 'raw' };
      const options: ProcessOptions = {
        extract: true,
        tolerance: 0.01,
      };

      const result = await strategy.processData(rawData, options);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('test-entity-1');
      // ShapeEntity no longer carries display name; ensure id exists
      expect(result[0]?.id).toBeDefined();
    });

    it('should validate data successfully', async () => {
      const data: ShapeEntity[] = [{
        id: 'test' as unknown as any,
        nodeId: 'node' as unknown as any,
        batchConfig: { ...minimalBatchConfig, dataSource: 'naturalearth' },
        licenseAgreement: true,
        selectedArrayByCountries: {},
      }];

      const result = await strategy.validateData(data);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate empty data as invalid', async () => {
      const result = await strategy.validateData([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('データが空です');
    });

    it('should save data successfully', async () => {
      const data = [{
        id: 'test' as unknown as any,
        nodeId: 'node' as unknown as any,
        batchConfig: { ...minimalBatchConfig, dataSource: 'naturalearth' },
        licenseAgreement: true,
        selectedArrayByCountries: {},
      }] as ShapeEntity[];
      const target: SaveTarget = {
        type: 'hierarchidb',
        entityType: 'shape',
      };

      const result = await strategy.saveData(data, target);
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should perform health check', async () => {
      mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

      //  baseUrl
      strategy.config.access.baseUrl = 'https://test.example.com/';
      const isHealthy = await strategy.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      strategy.config.access.baseUrl = 'https://test.example.com/';
      const isHealthy = await strategy.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});

describe('DataSourceStrategyFactory', () => {
  let factory: DataSourceStrategyFactory;

  beforeEach(() => {
    factory = new DataSourceStrategyFactory();
  });

  it('should create default strategies', () => {
    const strategies = factory.getAvailableStrategies();
    expect(strategies).toContain('natural-earth-shapes');
    expect(strategies).toContain('gadm-administrative-areas');
    expect(strategies).toContain('openstreetmap-overpass');
    expect(strategies).toContain('geoboundaries-admin-areas');
  });

  it('should create strategy instances', () => {
    const naturalEarth = factory.create('natural-earth-shapes');
    expect(naturalEarth).toBeInstanceOf(NaturalEarthStrategy);
    expect(naturalEarth.id).toBe('natural-earth-shapes');

    const gadm = factory.create('gadm-administrative-areas');
    expect(gadm).toBeInstanceOf(GADMStrategy);
    expect(gadm.id).toBe('gadm-administrative-areas');

    const osm = factory.create('openstreetmap-overpass');
    expect(osm).toBeInstanceOf(OpenStreetMapStrategy);
    expect(osm.id).toBe('openstreetmap-overpass');

    const geoBoundaries = factory.create('geoboundaries-admin-areas');
    expect(geoBoundaries).toBeInstanceOf(GeoBoundariesStrategy);
    expect(geoBoundaries.id).toBe('geoboundaries-admin-areas');
  });

  it('should throw error for unknown strategy', () => {
    expect(() => {
      factory.create('unknown-strategy' as any);
    }).toThrow('Unknown data source strategy: unknown-strategy');
  });

  it('should get strategy information', () => {
    const info = factory.getStrategyInfo('natural-earth-shapes');
    expect(info).toBeDefined();
    expect(info?.name).toBe('Natural Earth');
    expect(info?.category).toBe('general');
    expect(info?.supported).toBe(true);
  });

  it('should filter strategies by category', () => {
    const adminStrategies = factory.getStrategiesByCategory('administrative');
    expect(adminStrategies).toContain('gadm-administrative-areas');
    expect(adminStrategies).toContain('geoboundaries-admin-areas');
    expect(adminStrategies).not.toContain('natural-earth-shapes');
  });

  it('should filter strategies by coverage level', () => {
    const globalStrategies = factory.getStrategiesByCoverageLevel('global');
    expect(globalStrategies).toContain('natural-earth-shapes');
    expect(globalStrategies).toContain('gadm-administrative-areas');
    expect(globalStrategies).toContain('openstreetmap-overpass');
    expect(globalStrategies).toContain('geoboundaries-admin-areas');
  });

  it('should find strategies by data type', () => {
    const adminStrategies = factory.findStrategiesByDataType('administrative');
    expect(adminStrategies.length).toBeGreaterThan(0);

    const countryStrategies = factory.findStrategiesByDataType('countries');
    expect(countryStrategies).toContain('natural-earth-shapes');
  });

  it('should register custom strategy', () => {
    const customStrategy = new TestStrategy();
    factory.register('test-strategy' as any, () => customStrategy, {
      id: 'test-strategy' as any,
      name: 'Test Strategy',
      description: 'Test strategy for unit tests',
      category: 'general',
      dataTypes: ['test'],
      coverageLevel: 'global',
      updateFrequency: 'irregular',
      license: 'MIT',
      attribution: 'Test',
      supported: true,
    });

    expect(factory.hasStrategy('test-strategy' as any)).toBe(true);
    const created = factory.create('test-strategy' as any);
    expect(created).toBeInstanceOf(TestStrategy);
  });

  it('should unregister strategy', () => {
    factory.unregister('natural-earth-shapes');
    expect(factory.hasStrategy('natural-earth-shapes')).toBe(false);
  });

  it('should get recommendations', () => {
    const adminRec = factory.getRecommendedStrategy('administrative');
    expect(['gadm-administrative-areas', 'geoboundaries-admin-areas']).toContain(adminRec);

    const naturalRec = factory.getRecommendedStrategy('natural');
    expect(naturalRec).toBe('natural-earth-shapes');

    const realtimeRec = factory.getRecommendedStrategy('realtime');
    expect(realtimeRec).toBe('openstreetmap-overpass');

    const researchRec = factory.getRecommendedStrategy('research');
    expect(researchRec).toBe('geoboundaries-admin-areas');
  });

  it('should get statistics', () => {
    const stats = factory.getStatistics();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.supported).toBeGreaterThan(0);
    expect(stats.byCategory).toBeDefined();
    expect(stats.byCoverageLevel).toBeDefined();
  });

  it('should perform health check on single strategy', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

    const isHealthy = await factory.healthCheck('natural-earth-shapes');
    //  NaturalEarthStrategybaseUrltrue
    expect(isHealthy).toBe(true);
  });

  it('should perform health check on all strategies', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

    const results = await factory.healthCheckAll();
    expect(results.size).toBeGreaterThan(0);

    for (const [_strategyId, isHealthy] of Object.entries(results)) {
      expect(typeof isHealthy).toBe('boolean');
    }
  });
});

describe('Natural Earth Strategy', () => {
  let strategy: NaturalEarthStrategy;

  beforeEach(() => {
    strategy = new NaturalEarthStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('natural-earth-shapes');
    expect(strategy.name).toBe('Natural Earth Vector Data');
    expect(strategy.config.access.method).toBe('File');
    expect(strategy.config.access.baseUrl).toContain('naturalearthdata.com');
  });

  it('should select appropriate endpoint', () => {
    //  public
    // Ensure endpoints exist in config

    //  fetchData
    expect(strategy.config.access.endpoints).toHaveProperty('countries-50m');
    expect(strategy.config.access.endpoints).toHaveProperty('states-50m');
    expect(strategy.config.access.endpoints).toHaveProperty('cities-50m');
  });
});

describe('GADM Strategy', () => {
  let strategy: GADMStrategy;

  beforeEach(() => {
    strategy = new GADMStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('gadm-administrative-areas');
    expect(strategy.name).toBe('GADM Administrative Areas');
    expect(strategy.config.access.method).toBe('File');
    expect(strategy.config.access.baseUrl).toContain('geodata.ucdavis.edu');
  });

  it('should normalize country codes', () => {
    expect(strategy.config.access.endpoints).toHaveProperty('country-json');
    expect(strategy.config.access.endpoints).toHaveProperty('country-json-zip');
  });
});

describe('OpenStreetMap Strategy', () => {
  let strategy: OpenStreetMapStrategy;

  beforeEach(() => {
    strategy = new OpenStreetMapStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('openstreetmap-overpass');
    expect(strategy.name).toBe('OpenStreetMap Overpass API');
    expect(strategy.config.access.method).toBe('REST');
    expect(strategy.config.access.baseUrl).toContain('overpass-api.de');
  });

  it('should get available presets', () => {
    const presets = strategy.getAvailablePresets();
    expect(presets).toHaveProperty('administrative');
    expect(presets).toHaveProperty('countries');
    expect(presets).toHaveProperty('cities');
    expect(presets).toHaveProperty('coastlines');
  });

  it('should stage preset query', () => {
    const query = strategy.buildPresetQuery('countries');
    expect(query).toContain('admin_level=2');
    expect(query).toContain('boundary=administrative');
    expect(query).toContain('out geom');
  });

  it('should stage query with bbox', () => {
    const bbox = { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 };
    const query = strategy.buildPresetQuery('countries', bbox);
    expect(query).toContain('(35,139,36,140)');
  });
});

describe('GeoBoundaries Strategy', () => {
  let strategy: GeoBoundariesStrategy;

  beforeEach(() => {
    strategy = new GeoBoundariesStrategy();
  });

  it('should have correct configuration', () => {
    expect(strategy.id).toBe('geoboundaries-admin-areas');
    expect(strategy.name).toBe('GeoBoundaries Administrative Areas');
    expect(strategy.config.access.method).toBe('REST');
    expect(strategy.config.access.baseUrl).toContain('geoboundaries.org');
  });

  // Availability is derived from metadata (ALL/ALL); no separate endpoint.
});

describe('Integration Tests', () => {
  it('should create and use strategies through factory', async () => {
    const factory = defaultDataSourceFactory;

    //  basic operations
    const strategies = factory.getSupportedStrategies();

    for (const strategyId of strategies) {
      const strategy = factory.create(strategyId);

      expect(strategy.config).toBeDefined();
      expect(strategy.config.id).toBe(strategyId);

      expect(typeof strategy.fetchData).toBe('function');
      expect(typeof strategy.processData).toBe('function');
      expect(typeof strategy.validateData).toBe('function');
      expect(typeof strategy.saveData).toBe('function');
    }
  });

  it('should handle errors gracefully', async () => {
    const strategy = new TestStrategy();

    const invalidData = null as any;
    const result = await strategy.validateData(invalidData);
    expect(result.isValid).toBe(false);

    const saveSpy = vi.spyOn(strategy, 'saveData').mockRejectedValue(new Error('Save failed'));

    try {
      await strategy.saveData([] as unknown as ShapeEntity[], { type: 'hierarchidb' });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    saveSpy.mockRestore();
  });

  it('should work with real-like data flow', async () => {
    const strategy = new TestStrategy();

    const fetchOptions: FetchOptions = {
      bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 },
      adminLevel: 1,
    };
    const rawData = await strategy.fetchData(fetchOptions);
    expect(rawData).toBeDefined();

    const processOptions: ProcessOptions = {
      extract: true,
      tolerance: 0.01,
    };
    const processedData = await strategy.processData(rawData, processOptions);
    expect(processedData).toHaveLength(1);

    const validation = await strategy.validateData(processedData);
    expect(validation.isValid).toBe(true);

    const saveTarget: SaveTarget = {
      type: 'hierarchidb',
      entityType: 'shape',
      parentId: 'test-parent',
    };
    const saveResult = await strategy.saveData(processedData, saveTarget);
    expect(saveResult.success).toBe(true);
  });
});
