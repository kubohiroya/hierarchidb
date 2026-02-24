import { describe, expect, it } from 'vitest';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import type { RouteBuildTask } from '../../../services/RouteBuildSession';
import { RouteBuildSession } from '../../../services/RouteBuildSession';
import type { NodeId } from '@hierarchidb/core-types';
import { RouteGenerationMethod } from '../../entities/RouteEntity';
import { VtTaskQueueDb, deleteTasksByNode, putTasks } from '@hierarchidb/vt-orchestrator';
import type { RouteBuildSessionDeps } from '../../../services/RouteBuildSession';

class TestGenerator implements RouteBuildSessionDeps['generator'] {
  public activeOsm = 0;
  public maxOsm = 0;

  async generate(
    points: [number, number][],
    opts: { method: string; options?: Record<string, unknown> },
  ): Promise<unknown> {
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

function makeTasks(nodeId: NodeId, n: number, method: RouteGenerationMethod): RouteBuildTask[] {
  return Array.from({ length: n }, (_, i) => ({
    taskId: `${method}-${i}`,
    treeNodeId: nodeId,
    nodeId,
    stage: 'fetch',
    status: 'pending',
    index: i,
    routeData: { method, startCoordinates: [0, 0], endCoordinates: [1, 1] },
  }));
}

describe('RouteBuildSession lane gating', () => {
  const mapTaskQueueStage = (stage: RouteBuildTask['stage']): 'fetch' | 'transform' | 'vt' => {
    if (stage === 'location-resolution' || stage === 'route-generation') {
      return 'fetch';
    }
    if (stage === 'transform') return 'transform';
    return 'vt';
  };

  it('keeps osm_route concurrency at 1 even when maxConcurrent is high', async () => {
    const cfg: RouteBuildConfig = {
      routeGeneration: {
        method: 'osm_route',
        parallel: true,
        maxConcurrent: 8,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const nodeId = 'n1' as NodeId;
    const tasks: RouteBuildTask[] = [
      ...makeTasks(nodeId, 5, 'osm_route'),
      ...makeTasks(nodeId, 5, 'direct'),
    ];
    const queueDb = new VtTaskQueueDb();
    await deleteTasksByNode(queueDb, nodeId);
    await putTasks(queueDb, tasks.map((task) => ({
      taskId: task.taskId,
      nodeId: task.nodeId,
      stage: mapTaskQueueStage(task.stage),
      status: 'queued',
      index: task.index,
      progress: 0,
      inputData: {
        routeStage: task.stage,
        routeData: task.routeData,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })));
    const gen = new TestGenerator();
    const s = new RouteBuildSession(nodeId, cfg, tasks, {
      generator: gen,
    });
    const anySession = s as {
      findTask(taskId: string): RouteBuildTask | undefined;
      handleRouteGenerationTask(task: { taskId: string }): Promise<{ status: 'completed'; progress: number }>;
    };
    anySession.handleRouteGenerationTask = async (task) => {
      const localTask = anySession.findTask(task.taskId);
      if (!localTask) {
        throw new Error(`Unknown route task ${task.taskId}`);
      }
      localTask.status = 'running';
      localTask.error = undefined;

      const method = localTask.routeData?.method ?? 'osm_route';
      if (method === 'osm_route') {
        gen.activeOsm++;
        gen.maxOsm = Math.max(gen.maxOsm, gen.activeOsm);
        await new Promise((r) => setTimeout(r, 20));
        gen.activeOsm--;
      } else {
        await new Promise((r) => setTimeout(r, 5));
      }

      localTask.status = 'completed';
      return { status: 'completed', progress: 100 };
    };
    await s.initialize();
    await s.start();
    await deleteTasksByNode(queueDb, nodeId);
    expect(gen.maxOsm).toBe(1);
  });
});
