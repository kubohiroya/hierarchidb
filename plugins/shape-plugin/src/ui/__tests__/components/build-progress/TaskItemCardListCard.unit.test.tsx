import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms';
import { TaskItemCardListCard } from '../../../components/build-progress/TaskItemCardListCard/TaskItemCardListCard';
import type { TaskOutcomeSummaryBuilder } from '../../../components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';
import { createElement, useState } from 'react';
import type { NodeId } from "@hierarchidb/core-types";

vi.mock('../../../i18n.js', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
vi.mock('../../../components/build-progress/useShapeBuildStages/useShapeBuildStages', () => ({
  useShapeBuildStages: () => [
    { id: 'source', title: 'Source', icon: createElement('span', null, 'source') },
    { id: 'geometry', title: 'Geometry', icon: createElement('span', null, 'geometry') },
    { id: 'tileEmit', title: 'Vector Tiles', icon: createElement('span', null, 'tileEmit') },
  ],
}));

describe('TaskItemCardListCard', () => {
  it('renders country flag icon when country code is available', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'source:JP:0',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
        status: 'recycled',
        progress: 100,
      } as ShapeBuildTaskSummary,
      {
        taskId: 'task-2',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="source"
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

  it.skip('renders tileEmit flag overlay from parent tile intersecting countries', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'node-1:tileEmit:2:6:123',
        nodeId: 'node-1' as NodeId,
        stage: 'tileEmit',
        taskType: 'tileEmit',
        status: 'running',
        progress: 40,
        metadata: {
          tileEmitParentInputSummary: {
            parentTile: { z: 6, x: 10, y: 20 },
            intersectingFeatureCount: 3,
            intersectingGeojsonByteSize: 1024,
            topCountriesByIntersectingArea: [
              { countryCode: 'JP', intersectingAreaSqMeters: 1200 },
              { countryCode: 'US', intersectingAreaSqMeters: 800 },
            ],
          },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="tileEmit"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Running'}
          resolveStatusColor={() => 'info'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
        />
      </Provider>
    );

    expect(screen.getByTestId('task-icon-tileEmit-flag-overlay')).toBeTruthy();
    expect(screen.queryByTestId('task-icon-flag')).toBeNull();
  });

  it('shows compact geometry summary from metadata', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'geometry-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'geometry',
        taskType: 'geometry',
        status: 'failed',
        progress: 100,
        metadata: {
          effectiveTolerance: 0.125,
          retryAttempt: 2,
          retryMax: 10,
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="geometry"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Failed'}
          resolveStatusColor={() => 'error'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
        />
      </Provider>
    );

    expect(screen.getByText(/Tol: 0\.125/)).toBeTruthy();
    expect(screen.getByText(/Attempt: 2\/10/)).toBeTruthy();
    expect(screen.getByText(/Failed \(Tol: 0\.125/)).toBeTruthy();
  });

  it('keeps source and tileEmit with simple summary without N/A charts', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'source-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
        status: 'completed',
        progress: 100,
        metadata: {
          message: 'Loaded source data',
        },
      } as ShapeBuildTaskSummary,
      {
        taskId: 'tileEmit-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'tileEmit',
        taskType: 'tileEmit',
        status: 'failed',
        progress: 100,
        errorMessage: 'tileEmit failed: tile encode',
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="source"
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
    expect(summaries.some((text) => /Completed|Loaded source data/.test(text))).toBe(true);
    expect(summaries.some((text) => /Failed:/.test(text))).toBe(true);
  });

  it('accepts injected summary builder for source stage', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'source-task-2',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
        status: 'completed',
        progress: 100,
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();
    const fetchBuilder: TaskOutcomeSummaryBuilder = () => ({
      kind: 'completed',
      visualization: 'none',
      summaryLine: 'Injected source summary',
      detailLines: ['Injected source detail'],
    });

    render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="source"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Done'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={(task) => task.taskId}
          virtualize={false}
          summaryBuilders={{ source: fetchBuilder }}
        />
      </Provider>
    );

    expect(screen.getByText('Injected source summary')).toBeTruthy();
  });

  it('shows source detail in floating window with url and reduced counts', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'source-task-snackbar-1',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
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

    render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="source"
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

  it('shows geometry Features/Polygons as text and hides max-vertices marker when denominator is below limit', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'geometry-task-preview-1',
        nodeId: 'node-1' as NodeId,
        stage: 'geometry',
        taskType: 'geometry',
        status: 'completed',
        progress: 100,
        display: {
          kind: 'summary',
          metrics: {
            features: { input: 1, output: 1 },
            polygons: { input: 47, output: 47 },
            vertices: { input: 39550, output: 6552 },
          },
        },
        metadata: {
          retryAttempt: 2,
          retryMax: 24,
          maxPolygonVertices: { input: 3754, output: 3754 },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="geometry"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Completed'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={() => 'Geometry Task 1'}
          virtualize={false}
          isDetailFloatingWindowOpen
        />
      </Provider>
    );

    const chips = Array.from(view.container.querySelectorAll('[data-task-id] .MuiChip-root'));
    expect(chips.length).toBe(1);
    fireEvent.mouseEnter(chips[0]);

    expect(screen.getByText('Features: 1')).toBeTruthy();
    expect(screen.getByText('Polygons: 47')).toBeTruthy();
    expect(screen.getByText('3,754 / 3,754 (100%)')).toBeTruthy();
    expect(screen.queryByTestId('max-vertices-limit-marker')).toBeNull();
  });

  it('shows max-vertices marker when denominator exceeds limit', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'geometry-task-preview-2',
        nodeId: 'node-1' as NodeId,
        stage: 'geometry',
        taskType: 'geometry',
        status: 'completed',
        progress: 100,
        display: {
          kind: 'summary',
          metrics: {
            features: { input: 1, output: 1 },
            polygons: { input: 27, output: 27 },
            vertices: { input: 39550, output: 6552 },
          },
        },
        metadata: {
          retryAttempt: 1,
          retryMax: 24,
          maxPolygonVertices: { input: 17598, output: 2852 },
        },
      } as ShapeBuildTaskSummary,
    ];
    const store = createStore();

    const view = render(
      <Provider store={store}>
        <TaskItemCardListCard
          stageId="geometry"
          tasks={tasks}
          stageValue={0}
          resolveStatusLabel={() => 'Completed'}
          resolveStatusColor={() => 'success'}
          resolveTaskTitle={() => 'Geometry Task 2'}
          virtualize={false}
          isDetailFloatingWindowOpen
        />
      </Provider>
    );

    const chips = Array.from(view.container.querySelectorAll('[data-task-id] .MuiChip-root'));
    expect(chips.length).toBe(1);
    fireEvent.mouseEnter(chips[0]);

    expect(screen.getByText('2,852 / 17,598 (16.2%)')).toBeTruthy();
    expect(screen.getByTestId('max-vertices-limit-marker')).toBeTruthy();
  });

  it('toggles selected chip and keeps preview fixed while selected', () => {
    const tasks: ShapeBuildTaskSummary[] = [
      {
        taskId: 'source-task-1',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
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
        taskId: 'source-task-2',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
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
          stageId="source"
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
        taskId: 'source-task-auto-open-1',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
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
          stageId="source"
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
        taskId: 'source-task-close-sync-1',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
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
        taskId: 'source-task-close-sync-2',
        nodeId: 'node-1' as NodeId,
        stage: 'source',
        taskType: 'source',
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
            stageId="source"
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

    const titleBarButtons = Array.from(document.querySelectorAll('.floating-window .title-bar button')) as HTMLElement[];
    const closeButton = titleBarButtons.at(-1);
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Reopen preview' }));
    fireEvent.mouseEnter(chips[1]);

    expect(screen.getByText('URL: https://example.com/us/close-sync.geojson')).toBeTruthy();
  });
});
