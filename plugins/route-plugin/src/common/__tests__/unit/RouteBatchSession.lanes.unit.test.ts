import { describe, expect, it } from 'vitest';
import type { RouteBatchConfig } from '../../src/common/types/ObsolateBuildConfig.js';
import type { RouteBatchTask } from '../../src/services/RouteBatchSession.js';
import { RouteBatchSession } from '../../src/services/RouteBatchSession.js';
import type { NodeId } from '@hierarchidb/common-types';
import { RouteGenerationMethod } from '../entities/RouteEntity.js';

class TestGenerator {
  public activeOsm = 0;
  public maxOsm = 0;

  async generate(points: [number, number][], opts: { method: string; options?: any }): Promise<any> {
    if (opts.method === 'osm_route') {
      this.activeOsm++;
      this.maxOsm = Math.max(this.maxOsm, this.activeOsm);
      await new Promise((r) => setTimeout(r, 20));
      this.activeOsm--;
    } else {
      await new Promise((r) => setTimeout(r, 5));
    }
    return { lineGeometry: points, distance: 1, duration: 1 };
  }
}

function makeTasks(nodeId: NodeId, n: number, method: RouteGenerationMethod): RouteBatchTask[] {
  return Array.from({ length: n }, (_, i) => ({
    taskId: `${method}-${i}`,
    treeNodeId: nodeId,
    nodeId,
    taskType: 'route_generation',
    stage: 'route_generation',
    status: 'pending',
    index: i,
    routeData: { method, startCoordinates: [0, 0], endCoordinates: [1, 1] },
  }));
}

describe('RouteBatchSession lane gating', () => {
  it('keeps osm_route concurrency at 1 even when maxConcurrent is high', async () => {
    const cfg = {
      routeGeneration: {
        method: 'osm_route',
        parallel: true,
        maxConcurrent: 8,
        retryOnFailure: false,
        maxRetries: 0,
      },
    } as RouteBatchConfig;
    const nodeId = 'n1' as NodeId;
    const tasks: RouteBatchTask[] = [
      ...makeTasks(nodeId, 5, 'osm_route'),
      ...makeTasks(nodeId, 5, 'direct'),
    ];
    const gen = new TestGenerator();
    const s = new RouteBatchSession(nodeId, cfg, tasks, { generator: gen as any });
    await s.initialize();
    await s.start();
    expect(gen.maxOsm).toBe(1);
  });
});
