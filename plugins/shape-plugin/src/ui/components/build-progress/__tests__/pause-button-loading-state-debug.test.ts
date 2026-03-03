import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShapeBuildStopState } from '../internal/useShapeBuildStepLogic/useShapeBuildStopState';

describe('Pause Button Loading State Debug', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('forceResetStopState function', () => {
        it('should be available and callable', () => {
            const mockSessionRecord = {
                status: 'running' as const,
                nodeId: 'test-node',
                stageId: 'source',
                progress: { total: 100, completed: 50 },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const { result } = renderHook(() =>
                useShapeBuildStopState({ sessionRecord: mockSessionRecord })
            );

            expect(result.current.forceResetStopState).toBeDefined();
            expect(typeof result.current.forceResetStopState).toBe('function');

            // 初期状態では停止要求がない
            expect(result.current.isStopRequested).toBe(false);
            expect(result.current.isStopAccepted).toBe(false);
        });

        it('should reset stop state when called', () => {
            const mockSessionRecord = {
                status: 'running' as const,
                nodeId: 'test-node',
                stageId: 'source',
                progress: { total: 100, completed: 50 },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const { result } = renderHook(() =>
                useShapeBuildStopState({ sessionRecord: mockSessionRecord })
            );

            // 停止状態を設定
            act(() => {
                result.current.setIsStopRequested(true);
                result.current.setIsStopAccepted(true);
            });

            expect(result.current.isStopRequested).toBe(true);
            expect(result.current.isStopAccepted).toBe(true);
            expect(result.current.isStopRequestedInFlight).toBe(true);

            // forceResetStopState を呼び出し
            act(() => {
                result.current.forceResetStopState();
            });

            expect(result.current.isStopRequested).toBe(false);
            expect(result.current.isStopAccepted).toBe(false);
            expect(result.current.isStopRequestedInFlight).toBe(false);
        });

        it('should clear timeout when forceResetStopState is called', () => {
            const mockSessionRecord = {
                status: 'running' as const,
                nodeId: 'test-node',
                stageId: 'source',
                progress: { total: 100, completed: 50 },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const { result } = renderHook(() =>
                useShapeBuildStopState({ sessionRecord: mockSessionRecord })
            );

            // 停止状態を設定してタイマーを開始
            act(() => {
                result.current.setIsStopRequested(true);
            });

            expect(result.current.isStopRequested).toBe(true);

            // forceResetStopState を呼び出し
            act(() => {
                result.current.forceResetStopState();
            });

            expect(result.current.isStopRequested).toBe(false);

            // タイマーが進んでも状態が変わらないことを確認
            act(() => {
                vi.advanceTimersByTime(35000); // 35秒進める
            });

            expect(result.current.isStopRequested).toBe(false);
        });
    });

    describe('automatic timeout reset', () => {
        it('should reset stop state after 30 seconds when session status does not change', () => {
            const mockSessionRecord = {
                status: 'running' as const,
                nodeId: 'test-node',
                stageId: 'source',
                progress: { total: 100, completed: 50 },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const { result } = renderHook(() =>
                useShapeBuildStopState({ sessionRecord: mockSessionRecord })
            );

            // 停止状態を設定
            act(() => {
                result.current.setIsStopRequested(true);
            });

            expect(result.current.isStopRequested).toBe(true);

            // 30秒経過
            act(() => {
                vi.advanceTimersByTime(30000);
            });

            expect(result.current.isStopRequested).toBe(false);
            expect(result.current.isStopAccepted).toBe(false);
        });

        it('should not reset if session status changes to paused', () => {
            let sessionRecord = {
                status: 'running' as const,
                nodeId: 'test-node',
                stageId: 'source',
                progress: { total: 100, completed: 50 },
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const { result, rerender } = renderHook(
                ({ sessionRecord }) => useShapeBuildStopState({ sessionRecord }),
                { initialProps: { sessionRecord } }
            );

            // 停止状態を設定
            act(() => {
                result.current.setIsStopRequested(true);
            });

            expect(result.current.isStopRequested).toBe(true);

            // セッション状態を paused に変更
            sessionRecord = { ...sessionRecord, status: 'paused' };
            rerender({ sessionRecord });

            expect(result.current.isStopRequested).toBe(false);
            expect(result.current.isStopAccepted).toBe(false);
        });
    });

    describe('browser reload scenario', () => {
        it('should handle inconsistent state after browser reload', () => {
            // ブラウザリロード後のシナリオ：
            // - localStorage に autoResumeBuild フラグが残っている
            // - しかしセッションは実際には完了している
            const mockSessionRecord = {
                status: 'completed' as const,
                nodeId: 'test-node',
                stageId: 'source',
                progress: { total: 100, completed: 100 },
                createdAt: Date.now(),
                updatedAt: Date.now(),
                completedAt: Date.now(),
            };

            const { result } = renderHook(() =>
                useShapeBuildStopState({ sessionRecord: mockSessionRecord })
            );

            // 初期状態では停止要求がない（完了済みセッション）
            expect(result.current.isStopRequested).toBe(false);
            expect(result.current.isStopAccepted).toBe(false);
            expect(result.current.isStopRequestedInFlight).toBe(false);
        });
    });
});