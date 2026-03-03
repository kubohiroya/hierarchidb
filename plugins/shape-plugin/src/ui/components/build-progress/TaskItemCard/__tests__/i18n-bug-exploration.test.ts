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
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

// Mock translate function to track calls
const mockTranslate = vi.fn((key: string, fallback?: string) => fallback ?? key);

describe('Bug Condition Exploration: i18n Hardcoded Text', () => {
    beforeEach(() => {
        mockTranslate.mockClear();
    });

    it('should fail: buildGeometryTaskOutcomeSummary displays hardcoded Japanese text for skipped tasks', () => {
        const task: ShapeBuildTaskSummary = {
            taskId: 'test-node:geometry:JP:2',
            nodeId: 'test-node' as any,
            stage: 'geometry',
            status: 'skipped',
            progress: 0,
            display: {
                kind: 'message',
                message: 'データなし',
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

        // 期待される結果: テストが失敗する（これは正しい - バグが存在することを証明）
        // バグ条件: buildGeometryTaskOutcomeSummaryでタスクがスキップされた時、ハードコーディングされた日本語テキストが表示される
        expect(result.summaryLine).toContain('スキップ:');
        expect(result.detailLines).toEqual(expect.arrayContaining([
            expect.stringContaining('理由:')
        ]));

        // translate関数が呼び出されていないことを確認（バグの証明）
        expect(mockTranslate).not.toHaveBeenCalledWith('task.status.skipped', 'Skipped');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.status.reason', 'Reason');
    });

    it('should fail: buildGeometryTaskOutcomeSummary displays hardcoded Japanese text for completed tasks', () => {
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

        // バグ条件: buildGeometryTaskOutcomeSummaryでタスクが完了した時、ハードコーディングされた日本語テキストが表示される
        expect(result.summaryLine).toContain('完了');
        expect(result.detailLines).toEqual(expect.arrayContaining([
            expect.stringContaining('有効許容値:'),
            expect.stringContaining('試行回数:'),
            expect.stringContaining('最終データサイズ (F/Pol/V):'),
            expect.stringContaining('元データサイズ (F/Pol/V):'),
            expect.stringContaining('頂点削減率:'),
            expect.stringContaining('抽出率:'),
        ]));

        // translate関数が呼び出されていないことを確認（バグの証明）
        expect(mockTranslate).not.toHaveBeenCalledWith('task.status.completed', 'Completed');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.effectiveTolerance', 'Effective Tolerance');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.retryCount', 'Retry Count');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.finalDataSize', 'Final Data Size (F/Pol/V)');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.originalDataSize', 'Original Data Size (F/Pol/V)');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.vertexReductionRate', 'Vertex Reduction Rate');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.extractionRate', 'Extraction Rate');
    });

    it('should fail: buildGeometryTaskOutcomeSummary displays hardcoded Japanese text for failed tasks', () => {
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

        // バグ条件: buildGeometryTaskOutcomeSummaryでタスクが失敗した時、ハードコーディングされた日本語テキストが表示される
        expect(result.summaryLine).toContain('失敗');
        expect(result.detailLines).toEqual(expect.arrayContaining([
            expect.stringContaining('失敗理由:'),
        ]));

        // translate関数が呼び出されていないことを確認（バグの証明）
        expect(mockTranslate).not.toHaveBeenCalledWith('task.status.failed', 'Failed');
        expect(mockTranslate).not.toHaveBeenCalledWith('task.details.failureReason', 'Failure Reason');
    });
});