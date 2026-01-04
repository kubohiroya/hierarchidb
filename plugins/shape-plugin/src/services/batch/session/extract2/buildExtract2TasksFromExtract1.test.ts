import { describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { buildExtract2TasksFromExtract1 } from './buildExtract2TasksFromExtract1.js';
import type { ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';
import { BatchTaskStage } from '../../../../common/types/index.js';

describe('buildExtract2TasksFromExtract1', () => {
  it('builds extract2 tasks and inputs map derived from extract1 tasks', () => {
    const nodeId = 'node-1' as NodeId;
    const zoomRanges = [
      { minZoom: 0, maxZoom: 3, zoomLevels: [0, 1, 2, 3], label: 'z0-3' },
      { minZoom: 4, maxZoom: 7, zoomLevels: [4, 5, 6, 7], label: 'z4-7' },
    ];

    const extract1Tasks = [
      {
        taskId: 'extract1-0',
        nodeId,
        taskType: 'extract1',
        stage: BatchTaskStage.WAIT,
        type: 'extract1',
        status: 'waiting',
        index: 0,
        progress: 0,
        inputBufferId: 'raw-0',
        countryCode: 'JPN',
        adminLevel: 1,
      },
    ] as const;

    const extract1InputsByTaskId = new Map([
      ['extract1-0', {
        inputBufferId: 'raw-0',
        sourceUrl: 'https://example.test/source.fgb',
        featureId: 'Japan-ADM1',
        featureLabel: 'Japan',
        featureGroupId: 'continent-group:Asia',
        featureIndex: 0,
        originKey: 'ne:asia:jpn:adm1',
        originLabel: 'Japan (ADM1)',
        adminCode: 'JPN.1',
        dataSource: 'naturalearth',
        countryCode: 'JPN',
        adminLevel: 1,
        continent: 'Asia',
        countryName: 'Japan',
      } satisfies ShapeExtract1TaskInputData],
    ]);

    const res = buildExtract2TasksFromExtract1({
      nodeId,
      extract1Tasks: [...extract1Tasks],
      extract1InputsByTaskId,
      zoomRanges,
      scaleTolerance: (zoomMax) => zoomMax * 0.1,
      buildTaskId: (_stage, details) =>
        `extract2:${details.featureGroupId ?? 'none'}:${details.featureLabel ?? 'none'}:${details.zoomRangeLabel ?? 'none'}`,
      getOriginKeyFromInput: (input) => input?.originKey,
      resolveTaskIdDetails: (task, input) => ({
        countryCode: input?.countryCode ?? task.countryCode,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        featureLabel: input?.featureLabel,
        featureGroupId: input?.featureGroupId,
      }),
    });

    expect(res.tasks).toHaveLength(2);
    expect(res.inputsByTaskId.size).toBe(2);

    const task = res.tasks[0];
    expect(task.taskType).toBe('extract2');
    expect(task.stage).toBe(BatchTaskStage.WAIT);
    expect(task.inputBufferId).toBe('node-1-extract1-0');

    const input = res.inputsByTaskId.get(task.taskId);
    expect(input).toBeTruthy();
    expect(input?.inputBufferId).toBe('node-1-extract1-0');
    expect(input?.originKey).toBe('ne:asia:jpn:adm1');
    expect(input?.zoomRange).toEqual([0, 3]);
    expect(input?.zoomLevels).toEqual([0, 1, 2, 3]);
  });
});
