import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import { TaskListVirtualized } from '../../../components/build-progress/TaskListVirtualized.tsx';

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe('TaskListVirtualized', () => {
  it('renders cache reuse and new task icons', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-1',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: { cacheReuse: true },
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-2',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <TaskListVirtualized
          stageId="fetch"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Done'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
        />
      </Provider>
    );

    expect(screen.getAllByTestId('task-icon-recycling')).toHaveLength(1);
    expect(screen.getAllByTestId('task-icon-add')).toHaveLength(1);
  });
});
