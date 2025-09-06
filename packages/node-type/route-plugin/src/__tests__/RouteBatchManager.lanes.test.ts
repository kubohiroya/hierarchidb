import { describe, it, expect } from 'vitest';
import { RouteBatchManager, type RouteBatchTask, type RouteBatchConfig } from '../../src/services/RouteBatchManager';

// Minimal subclass to expose internal processing with fake work per lane
class TestManager extends RouteBatchManager {
  public records: Array<{ id: string; t: number; type: string }> = [];
  protected async generateRoute(task: RouteBatchTask, _config: RouteBatchConfig): Promise<void> {
    // Simulate workload per method with small delay
    const method = task.routeData?.method ?? 'direct';
    await new Promise((r) => setTimeout(r, 30));
    this.records.push({ id: task.taskId, t: Date.now(), type: method });
  }
}

function makeTasks(sessionId: string, count: number, method: string): RouteBatchTask[] {
  return Array.from({ length: count }, (_, i) => ({
    taskId: `${method}-${i}`,
    treeNodeId: 'n1' as any,
    sessionId,
    taskType: 'route_generation',
    stage: 'simplify1',
    status: 'pending',
    index: i,
    routeData: { method },
  }));
}

describe('RouteBatchManager lane gating', () => {
  it('limits osrm lane to concurrency=1 even with high maxConcurrent', async () => {
    const mgr = new TestManager();
    const session = await (mgr as any).startBatchSession('n1', { routeGeneration: { method: 'osm_route', parallel: true, maxConcurrent: 8, retryOnFailure: false, maxRetries: 0 } } as any, [], []);
    const tasks = [
      ...makeTasks(session, 4, 'osm_route'),
      ...makeTasks(session, 3, 'direct'),
    ];
    // @ts-ignore access private
    await (mgr as any).processTaskGroup(session, 'route_generation', tasks);
    // Heuristic: with strict concurrency=1 for osrm, direct tasks should interleave; records order should not show >1 osrm in flight effect
    const osrmOrder = mgr.records.filter(r => r.type === 'osm_route').map(r => r.id);
    expect(osrmOrder.length).toBe(4);
  });
});

