import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeDB } from '@hierarchidb/shape-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShapeQueryService } from '../../ShapeQueryService.js';

const hoisted = vi.hoisted(() => {
  const dbOpen = vi.fn(async () => {});
  const ephemeralOpen = vi.fn(async () => {});
  const buildTasksToArray = vi.fn(async () => []);
  const buildTasksEquals = vi.fn(() => ({ toArray: buildTasksToArray }));
  const buildTasksWhere = vi.fn(() => ({ equals: buildTasksEquals }));
  return {
    dbOpen,
    ephemeralOpen,
    buildTasksToArray,
    buildTasksEquals,
    buildTasksWhere,
  };
});

vi.mock('@hierarchidb/gis-sdk', () => ({
  ephemeralDB: {
    open: (...args: Parameters<typeof hoisted.ephemeralOpen>) => hoisted.ephemeralOpen(...args),
    buildTasks: {
      where: (...args: Parameters<typeof hoisted.buildTasksWhere>) => hoisted.buildTasksWhere(...args),
    },
  },
}));

const createShapeDbStub = (): ShapeDB => ({
  open: (...args: Parameters<typeof hoisted.dbOpen>) => hoisted.dbOpen(...args),
} as unknown as ShapeDB);
const SHAPE_CHUNK_STORE_DATABASE_NAME = 'test-shape-chunks';

describe('ShapeQueryService listBuildTasks metadata handoff', () => {
  beforeEach(() => {
    hoisted.dbOpen.mockClear();
    hoisted.ephemeralOpen.mockClear();
    hoisted.buildTasksWhere.mockClear();
    hoisted.buildTasksEquals.mockClear();
    hoisted.buildTasksToArray.mockReset();
  });

  it('keeps effectiveTolerance and retryAttempt from metadata in returned task summary', async () => {
    hoisted.buildTasksToArray.mockResolvedValue([
      {
        taskId: 'node-1:geometry:CR:0',
        nodeId: 'node-1',
        stage: 'geometry',
        status: 'completed',
        index: 1,
        progress: 100,
        retryCount: 0,
        metadata: {
          effectiveTolerance: 0.9,
          retryAttempt: 2,
        },
      },
    ]);

    const service = new ShapeQueryService(createShapeDbStub(), SHAPE_CHUNK_STORE_DATABASE_NAME);
    const tasks = await service.listBuildTasks('node-1' as NodeId);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.taskId).toBe('node-1:geometry:CR:0');
    expect(tasks[0]?.stageId).toBe('geometry-stage');
    expect((tasks[0]?.metadata as { effectiveTolerance?: number })?.effectiveTolerance).toBe(0.9);
    expect(tasks[0]?.retryAttempt).toBe(2);
    expect(hoisted.buildTasksWhere).toHaveBeenCalledWith('nodeId');
    expect(hoisted.buildTasksEquals).toHaveBeenCalledWith('node-1');
  });

  it('drops records with invalid stage values before returning task summaries', async () => {
    hoisted.buildTasksToArray.mockResolvedValue([
      {
        taskId: 'node-1:invalid:0',
        nodeId: 'node-1',
        stage: 'invalid-stage',
        status: 'completed',
        index: 9,
        progress: 100,
      },
      {
        taskId: 'node-1:source:0',
        nodeId: 'node-1',
        stage: 'source',
        status: 'completed',
        index: 1,
        progress: 100,
        metadata: {
          effectiveTolerance: 0.1,
          retryAttempt: 0,
        },
      },
    ]);

    const service = new ShapeQueryService(createShapeDbStub(), SHAPE_CHUNK_STORE_DATABASE_NAME);
    const tasks = await service.listBuildTasks('node-1' as NodeId);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.stage).toBe('source');
    expect(tasks[0]?.stageId).toBe('source-stage');
    expect(tasks[0]?.taskId).toBe('node-1:source:0');
  });
});
