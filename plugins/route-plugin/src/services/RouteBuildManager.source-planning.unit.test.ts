// @vitest-environment node

import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import {
  ROUTE_MODES,
  type RouteBuildConfig,
  type RouteBuildRouteInput,
} from '@hierarchidb/route-api';
import { deleteTasksByNode, listTasksByStatus, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../common/config/buildConfig.js';
import {
  materializeSourcePlannedRouteGeneration,
  materializeSourcePlannedRouteGenerationMethod,
  RouteBuildManager,
} from './RouteBuildManager.js';
import type { RouteBuildTaskQueueInput } from './RouteBuildSession.js';

const nodeId = 'route-source-planning-manager' as NodeId;
const ephemeralStore = initializeEphemeralDB('route-source-planning-manager-test');
const taskQueue = new VtTaskQueueDb();

describe('materializeSourcePlannedRouteGenerationMethod', () => {
  afterEach(async () => {
    await deleteTasksByNode(taskQueue, nodeId);
  });

  afterAll(async () => {
    await deleteTasksByNode(taskQueue, nodeId);
    ephemeralStore.close();
    await ephemeralStore.delete();
  });

  it('materializes airway routes as great-circle generation', () => {
    expect(materializeMethod(ROUTE_MODES.AIRWAY)).toBe('great_circle');
  });

  it('materializes waterway routes as searoute generation', () => {
    expect(materializeMethod(ROUTE_MODES.WATERWAY)).toBe('searoute');
  });

  it('materializes land routes from the configured direct default', () => {
    expect(materializeMethod(ROUTE_MODES.RAILWAY)).toBe('direct');
    expect(materializeMethod(ROUTE_MODES.H_RAILWAY)).toBe('direct');
    expect(materializeMethod(ROUTE_MODES.ROAD)).toBe('direct');
    expect(materializeMethod(ROUTE_MODES.HIGHWAY)).toBe('direct');
  });

  it('uses the configured node method for land routes', () => {
    expect(materializeGeneration(ROUTE_MODES.ROAD, undefined, 'osm_route').method).toBe('osm_route');
    expect(materializeGeneration(ROUTE_MODES.RAILWAY, undefined, 'custom').method).toBe('custom');
  });

  it('keeps compatible explicit route input methods authoritative', () => {
    expect(materializeMethod(ROUTE_MODES.ROAD, 'osm_route', 'direct')).toBe('osm_route');
    expect(materializeMethod(ROUTE_MODES.RAILWAY, 'custom', 'direct')).toBe('custom');
  });

  it('rejects explicit methods that violate fixed airway and waterway strategies', () => {
    expect(() => materializeMethod(ROUTE_MODES.AIRWAY, 'direct')).toThrow(
      'routeMode airway requires generation method great_circle'
    );
    expect(() => materializeMethod(ROUTE_MODES.WATERWAY, 'great_circle')).toThrow(
      'routeMode waterway requires generation method searoute'
    );
    expect(() => materializeMethod(ROUTE_MODES.WATERWAY, 'direct')).toThrow(
      'routeMode waterway requires generation method searoute'
    );
  });

  it('rejects configured land methods outside direct or network routing', () => {
    expect(() => materializeGeneration(ROUTE_MODES.ROAD, undefined, 'searoute')).toThrow(
      'routeMode road does not support generation method searoute'
    );
    expect(() => materializeGeneration(ROUTE_MODES.RAILWAY, undefined, 'great_circle')).toThrow(
      'routeMode railway does not support generation method great_circle'
    );
  });

  it('materializes zoom-aware great-circle detail for airway routes', () => {
    expect(materializeGeneration(ROUTE_MODES.AIRWAY).options).toEqual({ numPoints: 128 });
  });

  it('materializes route task data through the build manager path', async () => {
    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeMethodSettings: {
        defaults: DEFAULT_ROUTE_BUILD_CONFIG.routeMethodSettings.defaults,
        overrides: {
          road: { method: 'osm_route' },
          railway: { method: 'custom' },
        },
      },
    };
    const manager = new RouteBuildManager({
      session: { ephemeralStore },
    });

    await manager.createRouteBuildSession(nodeId, config, [
      createRouteInput(ROUTE_MODES.AIRWAY, 'location-air-start', 'location-air-end'),
      createRouteInput(ROUTE_MODES.WATERWAY, 'location-sea-start', 'location-sea-end'),
      createRouteInput(ROUTE_MODES.ROAD, 'location-road-start', 'location-road-end'),
      createRouteInput(ROUTE_MODES.RAILWAY, 'location-rail-start', 'location-rail-end', 'custom'),
    ]);

    const sourceTasks = (await listTasksByStatus(taskQueue, nodeId, 'queued')).flatMap((task) => {
      const inputData = task.inputData as RouteBuildTaskQueueInput | undefined;
      if (inputData?.routeStage !== 'source') return [];
      return inputData.routeData === undefined ? [] : [inputData.routeData];
    });

    expect(sourceTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ routeMode: ROUTE_MODES.AIRWAY, method: 'great_circle' }),
        expect.objectContaining({ routeMode: ROUTE_MODES.WATERWAY, method: 'searoute' }),
        expect.objectContaining({ routeMode: ROUTE_MODES.ROAD, method: 'osm_route' }),
        expect.objectContaining({ routeMode: ROUTE_MODES.RAILWAY, method: 'custom' }),
      ])
    );
  });
});

const materializeMethod = (
  routeMode: RouteBuildRouteInput['routeMode'],
  method?: RouteBuildRouteInput['method'],
  configuredMethod: RouteBuildRouteInput['method'] = 'direct'
) =>
  materializeSourcePlannedRouteGenerationMethod(
    {
      routeMode,
      ...(method === undefined ? {} : { method }),
    },
    configuredMethod
  );

const materializeGeneration = (
  routeMode: RouteBuildRouteInput['routeMode'],
  method?: RouteBuildRouteInput['method'],
  configuredMethod?: RouteBuildRouteInput['method']
) =>
  materializeSourcePlannedRouteGeneration(
    {
      routeMode,
      ...(method === undefined ? {} : { method }),
    },
    {
      routeMethodSettings: {
        defaults: DEFAULT_ROUTE_BUILD_CONFIG.routeMethodSettings.defaults,
        ...(configuredMethod === undefined
          ? {}
          : {
              overrides: {
                [routeMode]: {
                  method: configuredMethod,
                },
              },
            }),
      },
      geometryConfig: DEFAULT_ROUTE_BUILD_CONFIG.geometryConfig,
    }
  );

const createRouteInput = (
  routeMode: RouteBuildRouteInput['routeMode'],
  startLocationId: string,
  endLocationId: string,
  method?: RouteBuildRouteInput['method']
): RouteBuildRouteInput => ({
  startLocationId: startLocationId as NodeId,
  endLocationId: endLocationId as NodeId,
  startCoordinates: [0, 0],
  endCoordinates: [1, 1],
  routeMode,
  ...(method === undefined ? {} : { method }),
});
