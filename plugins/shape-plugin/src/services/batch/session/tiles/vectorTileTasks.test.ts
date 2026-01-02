import { describe, expect, it, vi } from 'vitest';
import { buildVectorTileTasks } from './vectorTileTasks.js';
import type { NodeId } from '@hierarchidb/common-types';

describe('buildVectorTileTasks', () => {
  it('generates tasks and inputs with zoom clamping', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { tasks, inputsByTaskId } = buildVectorTileTasks({
      nodeId: 'node-1' as NodeId,
      tileRows: [
        { key: 'k0', z: 0, x: 0, y: 0 },
        { key: 'k1', z: 1, x: 0, y: 0 },
        { key: 'k2', z: 2, x: 0, y: 0 },
      ],
      config: {
        vectorTiles: {
          minZoom: 1,
          maxZoom: 1,
        },
      },
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.taskType).toBe('vectortile');
    expect(inputsByTaskId.size).toBe(1);

    const [taskId] = Array.from(inputsByTaskId.keys());
    expect(taskId).toBe('node-1-vectortile-0');

    const input = inputsByTaskId.get(taskId!);
    expect(input?.tileZ).toBe(1);
    expect(input?.inputBufferId).toBe('k1');

    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

