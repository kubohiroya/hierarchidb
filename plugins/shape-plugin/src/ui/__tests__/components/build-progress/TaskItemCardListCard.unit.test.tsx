import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms';
import { TaskItemCardListCard } from '../../../components/build-progress/TaskItemCardListCard/TaskItemCardListCard';
import type { TaskOutcomeSummaryBuilder } from '../../../components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';
import { createElement, useState } from 'react';
import { NodeId } from "@hierarchidb/core-types";

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
  it('renders country flag icon when country code is available', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch:JP:0',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'recycled',
        progress: 100,
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-2',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
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

    expect(screen.getAllByTestId('task-icon-flag')).toHaveLength(1);
  });

  it('shows compact transform summary from metadata', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'transform-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'transform',
        taskType: 'transform',
        status: 'failed',
        progress: 100,
        metadata: {
          effectiveTolerance: 0.125,
          retryAttempt: 2,
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="transform"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Failed'}
          resolveStatusColor={() => 'error'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
        />
      </Provider>
    );

    expect(screen.getByText(/Tol 0\.125/)).toBeTruthy();
    expect(screen.getByText(/Retry 2\/10/)).toBeTruthy();
    expect(screen.getByText('Failed: retry 2')).toBeTruthy();
  });

  it('keeps fetch and vt with simple summary without N/A charts', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          message: 'Fetched data',
        },
      } as ShapeBuildTaskSummary,
      {
        taskId: 'vt-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'vt',
        taskType: 'vt',
        status: 'failed',
        progress: 100,
        errorMessage: 'vt failed: tile encode',
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
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

    expect(screen.queryByText('N/A')).toBeNull();
    const summaries = screen.getAllByTestId('task-inline-summary')
      .map((element) => element.textContent ?? '');
    expect(summaries.some((text) => /Completed|Fetched data/.test(text))).toBe(true);
    expect(summaries.some((text) => /Failed:/.test(text))).toBe(true);
  });

  it('accepts injected summary builder for fetch stage', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch-task-2',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();
    const fetchBuilder: TaskOutcomeSummaryBuilder = () => ({
      kind: 'completed',
      visualization: 'none',
      summaryLine: 'Injected fetch summary',
      detailLines: ['Injected fetch detail'],
    });

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="fetch"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Done'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
          summaryBuilders={{ fetch: fetchBuilder }}
        />
      </Provider>
    );

    expect(screen.getByText('Injected fetch summary')).toBeTruthy();
  });

  it('shows fetch detail in floating window with url and reduced counts', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch-task-snackbar-1',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          fetchDetail: {
            countryCode: 'JP',
            countryName: 'Japan',
            adminLevel: 0,
            url: 'https://example.com/jp/adm0.geojson',
            features: { input: 10000, output: 5000 },
            polygons: { input: 25000, output: 10000 },
          },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="fetch"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Completed'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={() => 'Japan (JP) 0'}
          virtualize={false}
          isDetailFloatingWindowOpen
        />
      </Provider>
    );

    const chips = Array.from(new Set(
      screen.getAllByText('Completed')
        .map((element) => element.closest('.MuiChip-root'))
        .filter((element): element is HTMLElement => Boolean(element))
        .filter((element) => element.closest('[data-task-id]')),
    ));
    expect(chips.length).toBe(1);
    fireEvent.mouseEnter(chips[0]);

    expect(screen.getByText('URL: https://example.com/jp/adm0.geojson')).toBeTruthy();
    expect(screen.getByText('Features')).toBeTruthy();
    expect(screen.getByText('5,000 / 10,000 (50%)')).toBeTruthy();
    expect(screen.getByText('Polygons')).toBeTruthy();
    expect(screen.getByText('10,000 / 25,000 (40%)')).toBeTruthy();
  });

  it('toggles selected chip and keeps preview fixed while selected', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          fetchDetail: {
            countryCode: 'JP',
            countryName: 'Japan',
            adminLevel: 0,
            url: 'https://example.com/jp/a.geojson',
            features: { input: 100, output: 50 },
            polygons: { input: 100, output: 50 },
          },
        },
      } as ShapeBuildTaskSummary,
      {
        taskId: 'fetch-task-2',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          fetchDetail: {
            countryCode: 'US',
            countryName: 'United States',
            adminLevel: 0,
            url: 'https://example.com/us/b.geojson',
            features: { input: 200, output: 100 },
            polygons: { input: 200, output: 100 },
          },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="fetch"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Completed'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
          isDetailFloatingWindowOpen
        />
      </Provider>
    );

    const chips = Array.from(view.container.querySelectorAll('[data-task-id] .MuiChip-root'));
    expect(chips.length).toBe(2);

    fireEvent.mouseEnter(chips[0]);
    expect(screen.getByText('URL: https://example.com/jp/a.geojson')).toBeTruthy();

    fireEvent.click(chips[0]);
    fireEvent.mouseEnter(chips[1]);
    expect(screen.getByText('URL: https://example.com/jp/a.geojson')).toBeTruthy();

    fireEvent.click(chips[0]);
    fireEvent.mouseEnter(chips[1]);
    expect(screen.getByText('URL: https://example.com/us/b.geojson')).toBeTruthy();
  });

  it('opens floating window when first chip selection happens while hidden', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch-task-auto-open-1',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          fetchDetail: {
            countryCode: 'JP',
            countryName: 'Japan',
            adminLevel: 0,
            url: 'https://example.com/jp/auto-open.geojson',
            features: { input: 10, output: 5 },
            polygons: { input: 10, output: 5 },
          },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();
    const onOpenDetailFloatingWindow = vi.fn();

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="fetch"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Completed'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
          isDetailFloatingWindowOpen={false}
          onOpenDetailFloatingWindow={onOpenDetailFloatingWindow}
        />
      </Provider>
    );

    const chips = Array.from(view.container.querySelectorAll('[data-task-id] .MuiChip-root'));
    expect(chips.length).toBe(1);
    fireEvent.click(chips[0]);
    expect(onOpenDetailFloatingWindow).toHaveBeenCalledTimes(1);
  });

  it('clears selected chip when floating window is closed from close button', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'fetch-task-close-sync-1',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          fetchDetail: {
            countryCode: 'JP',
            countryName: 'Japan',
            adminLevel: 0,
            url: 'https://example.com/jp/close-sync.geojson',
            features: { input: 100, output: 50 },
            polygons: { input: 100, output: 50 },
          },
        },
      } as ShapeBuildTaskSummary,
      {
        taskId: 'fetch-task-close-sync-2',
        nodeId: 'node-1' as NodeId,
        stage: 'fetch',
        taskType: 'fetch',
        status: 'completed',
        progress: 100,
        metadata: {
          fetchDetail: {
            countryCode: 'US',
            countryName: 'United States',
            adminLevel: 0,
            url: 'https://example.com/us/close-sync.geojson',
            features: { input: 200, output: 100 },
            polygons: { input: 200, output: 100 },
          },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const Harness = () => {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Reopen preview</button>
          <TaskItemCardListCard
            stageId="fetch"
            tasks={tasks}
            stageValue={0}
            resolveStatusLabel={() => 'Completed'}
            resolveStatusColor={() => 'success'}
            resolveTaskTitle={(task) => task.taskId}
            virtualize={false}
            isDetailFloatingWindowOpen={open}
            onCloseDetailFloatingWindow={() => setOpen(false)}
          />
        </>
      );
    };

    const view = render(
      <Provider store={store}>
        <Harness />
      </Provider>
    );

    const chips = Array.from(view.container.querySelectorAll('[data-task-id] .MuiChip-root'));
    expect(chips.length).toBe(2);

    fireEvent.click(chips[0]);
    expect(screen.getByText('URL: https://example.com/jp/close-sync.geojson')).toBeTruthy();

    const closeButtons = view.container.querySelectorAll('[aria-label="Close preview"]');
    const closeButton = closeButtons[0] as HTMLElement | undefined;
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Reopen preview' }));
    fireEvent.mouseEnter(chips[1]);

    expect(screen.getByText('URL: https://example.com/us/close-sync.geojson')).toBeTruthy();
  });
});
