import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms';
import { TaskItemCardListCard } from '../../../components/build-progress/TaskItemCardListCard/TaskItemCardListCard';
import { createElement } from 'react';

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
vi.mock('../../../components/build-progress/useShapeBuildStages/useShapeBuildStages', () => ({
  useShapeBuildStages: () => [
    { id: 'fetch', title: 'Fetch', icon: createElement('span', null, 'fetch') },
    { id: 'transform', title: 'Transform', icon: createElement('span', null, 'transform') },
    { id: 'vt', title: 'Vector Tiles', icon: createElement('span', null, 'vt') },
  ],
}));

describe('TaskItemCardListCard', () => {
  it('renders recycled and stage task icons', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'task-1',
        nodeId: 'node-1',
        stage: 'fetch',
        taskType: 'fetch',
        status: 'recycled',
        progress: 100,
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
        <TaskItemCardListCard
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
    expect(screen.getAllByTestId('task-icon-stage-fetch')).toHaveLength(1);
  });
});
