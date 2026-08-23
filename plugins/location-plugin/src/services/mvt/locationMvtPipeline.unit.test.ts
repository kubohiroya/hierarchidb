// @vitest-environment node

import type { NodeId } from '@hierarchidb/core-types';
import { EphemeralDB } from '@hierarchidb/gis-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  LocationBuildConfig,
  LocationMvtBuildConfig,
} from '~/common/entities/LocationEntity.js';
import type { LocationPointId, LocationPointProperties } from '~/common/entities/LocationPoint.js';
import {
  buildLocationGeometryCacheId,
  persistLocationGeometryArtifacts,
  requireLocationMvtBands,
} from './locationMvtGeometryArtifacts.js';
import { createDefaultLocationMvtBuildConfig } from './locationMvtConfig.js';
import { prepareLocationTileEmitTasks } from './locationMvtTileEmit.js';

describe('location MVT geometry and tileEmit planning', () => {
  let store: EphemeralDB;
  const nodeId = 'location-mvt-node' as NodeId;

  beforeEach(async () => {
    store = new EphemeralDB('test-location-mvt-pipeline');
    await store.open();
  });

  afterEach(async () => {
    store.close();
    await store.delete();
  });

  it('persists location geometry artifacts and plans tileEmit tasks from tile relations', async () => {
    const buildConfig = createLocationBuildConfig({
      zoomBands: [
        {
          id: 'global',
          minZoom: 3,
          maxZoom: 5,
          types: ['airport'],
          maxRenderRank: 1,
          minImportance: 0.7,
        },
      ],
    });
    const point = createAirportPoint();

    const output = await persistLocationGeometryArtifacts({
      nodeId,
      points: [point],
      buildConfig,
      sourceContentHash: 'source-content',
      sourceInputHash: 'source-input',
      store,
    });

    expect(output.artifacts).toEqual([
      expect.objectContaining({
        geometryCacheId: buildLocationGeometryCacheId(nodeId, 0),
        bandIndex: 0,
        zMin: 3,
        zMax: 5,
        zBase: 3,
        featureCount: 1,
        tileCount: 1,
      }),
    ]);
    expect(output.relationCount).toBe(1);

    const records = await store.geometryCache.where('nodeId').equals(nodeId).toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      nodeId,
      domainType: 'location',
      bandIndex: 0,
      sourceKey: 'global',
      featureCount: 1,
      metadata: expect.objectContaining({
        sourceLayer: 'location_points',
        format: 'flatgeobuf',
        featureCount: 1,
      }),
    });
    expect(records[0]?.data.byteLength).toBeGreaterThan(0);

    const relations = await store.tileEmitBufferRelations.where('nodeId').equals(nodeId).toArray();
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      nodeId,
      domainType: 'location',
      bandIndex: 0,
      bufferId: buildLocationGeometryCacheId(nodeId, 0),
      featureCount: 1,
    });

    const tasks = await prepareLocationTileEmitTasks({
      nodeId,
      bands: requireLocationMvtBands(buildConfig.mvt),
      expectedGeometryCacheIds: output.artifacts.map((artifact) => artifact.geometryCacheId),
      startIndex: 2,
      store,
    });

    expect(tasks).toEqual([
      expect.objectContaining({
        index: 2,
        inputData: expect.objectContaining({
          bandIndex: 0,
          zBase: 3,
          bufferIds: [buildLocationGeometryCacheId(nodeId, 0)],
          domainType: 'location',
          sourceKey: 'global',
        }),
      }),
    ]);
  });

  it('rejects missing render classification fields before applying LOD filters', async () => {
    const buildConfig = createLocationBuildConfig({
      zoomBands: [
        {
          id: 'global',
          minZoom: 0,
          maxZoom: 1,
          types: ['airport'],
          maxRenderRank: 1,
          minImportance: 0.7,
        },
      ],
    });
    const point = createAirportPoint();
    const invalidPoint = {
      ...point,
      pointId: 'airport-missing-render-rank' as LocationPointId,
      renderRank: undefined,
      minZoom: 3,
    } as unknown as LocationPointProperties;

    await expect(
      persistLocationGeometryArtifacts({
        nodeId,
        points: [invalidPoint],
        buildConfig,
        sourceContentHash: 'source-content',
        sourceInputHash: 'source-input',
        store,
      })
    ).rejects.toThrow('[location mvt] location point[0].renderRank must be a positive integer');
    await expect(store.geometryCache.where('nodeId').equals(nodeId).count()).resolves.toBe(0);
    await expect(
      store.tileEmitBufferRelations.where('nodeId').equals(nodeId).count()
    ).resolves.toBe(0);
  });
});

const createLocationBuildConfig = (mvt: Partial<LocationMvtBuildConfig>): LocationBuildConfig => ({
  searchConfigs: [
    {
      dataSource: 'manual',
      types: ['airport'],
    },
  ],
  processingOptions: { concurrent: 1 },
  mvt: {
    ...createDefaultLocationMvtBuildConfig(),
    ...mvt,
  },
});

const createAirportPoint = (): LocationPointProperties => ({
  schemaVersion: 2,
  pointId: 'airport-a' as LocationPointId,
  name: 'Airport A',
  latitude: 35,
  longitude: 139,
  type: 'airport',
  renderRank: 1,
  importance: 0.9,
  iconKey: 'flight_takeoff',
  labelClass: 'major',
  minZoom: 3,
  admin0Code: 'JP',
});
