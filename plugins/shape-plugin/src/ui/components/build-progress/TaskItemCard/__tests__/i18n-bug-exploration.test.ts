/**
 * Bug Condition Exploration Test - i18n Hardcoded Text
 * 
 * 重要: 修正実装前にこのテストを作成する
 * 目標: バグが存在することを実証する反例を表面化する
 * 期待される結果: テストが失敗する（これは正しい - バグが存在することを証明）
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGeometryTaskOutcomeSummary } from '../taskOutcomeSummaryBuilders';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';

// Mock translate function to track calls
const mockTranslate = vi.fn((key: string, fallback?: string) => fallback ?? key);

describe('Bug Condition Exploration: i18n Hardcoded Text', () => {
    beforeEach(() => {
        mockTranslate.mockClear();
    });

    it('uses translate() labels for skipped tasks', () => {
        const task: ShapeBuildTaskSummary = {
            taskId: 'test-node:geometry:JP:2',
            nodeId: 'test-node' as any,
            stage: 'geometry',
            status: 'running',
            progress: 0,
            display: {
                kind: 'skip',
            },
            metadata: {
                reason: 'ソースファイルが見つかりません',
            },
        };

        const result = buildGeometryTaskOutcomeSummary({
            task,
            stageId: 'geometry',
            taskTitle: 'Test Geometry Task',
            translate: mockTranslate,
        });

        expect(result.summaryLine).toContain('Skipped:');
        expect(result.detailLines).toEqual(expect.arrayContaining([
            expect.stringContaining('Reason:')
        ]));

        expect(mockTranslate).toHaveBeenCalledWith('task.status.skipped', 'Skipped');
        expect(mockTranslate).toHaveBeenCalledWith('task.status.reason', 'Reason');
    });

    it('uses translate() labels for completed tasks', () => {
        const task: ShapeBuildTaskSummary = {
            taskId: 'test-node:geometry:JP:1',
            nodeId: 'test-node' as any,
            stage: 'geometry',
            status: 'completed',
            progress: 100,
            retryAttempt: 2,
            display: {
                kind: 'summary',
                metrics: {
                    features: { input: 1000, output: 800 },
                    polygons: { input: 2000, output: 1600 },
                    vertices: { input: 50000, output: 40000 },
                },
            },
            metadata: {
                finalTolerance: 0.001,
                retryCount: 2,
            },
        };

        const result = buildGeometryTaskOutcomeSummary({
            task,
            stageId: 'geometry',
            taskTitle: 'Test Geometry Task',
            translate: mockTranslate,
        });

        expect(result.summaryLine).toContain('Completed');
        expect(result.detailLines).toEqual(expect.arrayContaining([
            expect.stringContaining('Effective Tolerance:'),
            expect.stringContaining('Retry Count:'),
            expect.stringContaining('Final Data Size (F/Pol/V):'),
            expect.stringContaining('Original Data Size (F/Pol/V):'),
            expect.stringContaining('Vertex Reduction Rate:'),
            expect.stringContaining('Extraction Rate:'),
        ]));

        expect(mockTranslate).toHaveBeenCalledWith('task.status.completed', 'Completed');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.effectiveTolerance', 'Effective Tolerance');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.retryCount', 'Retry Count');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.finalDataSize', 'Final Data Size (F/Pol/V)');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.originalDataSize', 'Original Data Size (F/Pol/V)');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.vertexReductionRate', 'Vertex Reduction Rate');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.extractionRate', 'Extraction Rate');
    });

    it('uses translate() labels for failed tasks', () => {
        const task: ShapeBuildTaskSummary = {
            taskId: 'test-node:geometry:JP:3',
            nodeId: 'test-node' as any,
            stage: 'geometry',
            status: 'failed',
            progress: 100,
            retryAttempt: 3,
            errorMessage: 'Geometry simplification failed',
            display: {
                kind: 'summary',
                metrics: {
                    features: { input: 1000, output: 800 },
                    polygons: { input: 2000, output: 1600 },
                    vertices: { input: 50000, output: 40000 },
                },
            },
            metadata: {
                finalTolerance: 0.001,
                retryCount: 3,
            },
        };

        const result = buildGeometryTaskOutcomeSummary({
            task,
            stageId: 'geometry',
            taskTitle: 'Test Geometry Task',
            translate: mockTranslate,
        });

        expect(result.summaryLine).toContain('Failed');
        expect(result.detailLines).toEqual(expect.arrayContaining([
            expect.stringContaining('Failure Reason:'),
        ]));

        expect(mockTranslate).toHaveBeenCalledWith('task.status.failed', 'Failed');
        expect(mockTranslate).toHaveBeenCalledWith('task.details.failureReason', 'Failure Reason');
    });
});
