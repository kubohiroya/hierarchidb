import { describe, expect, it } from 'vitest';
import type { RouteBatchConfig, RouteBatchTask } from '../../src/services/RouteBatchSession';
import { RouteBatchSession } from '../../src/services/RouteBatchSession';

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

function makeTasks(sessionId: string, n: number, method: string): RouteBatchTask[] {
  return Array.from({ length: n }, (_, i) => ({
    taskId: `${method}-${i}`,
    treeNodeId: 'n1' as any,
    sessionId,
    taskType: 'route_generation',
    stage: 'route_generation',
    status: 'pending',
    index: i,
    routeData: { method, startCoordinates: [0, 0], endCoordinates: [1, 1] },
  }));
}

describe('RouteBatchSession lane gating', () => {
  it('keeps osm_route concurrency at 1 even when maxConcurrent is high', async () => {
    const sessionId = 's1';
    const cfg = {
      routeGeneration: {
        method: 'osm_route',
        parallel: true,
        maxConcurrent: 8,
        retryOnFailure: false,
        maxRetries: 0,
      },
    } as RouteBatchConfig;
    const tasks: RouteBatchTask[] = [
      ...makeTasks(sessionId, 5, 'osm_route'),
      ...makeTasks(sessionId, 5, 'direct'),
    ];
    const gen = new TestGenerator() as any;
    const s = new RouteBatchSession(sessionId, 'n1' as any, cfg, tasks, undefined, { generator: gen });
    await s.initialize();
    await s.start();
    expect((gen as TestGenerator).maxOsm).toBe(1);
  });
});

