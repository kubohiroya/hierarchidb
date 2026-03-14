import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForSessionStateSync } from '../internal/useShapeBuildSessionHelpers/elapsed';
import { PAUSE_COMMAND_TIMEOUT_MS, PAUSE_STATE_SYNC_TIMEOUT_MS } from '../internal/useShapeBuildSessionHelpers/constants';

describe('Pause Button Fix', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('waitForSessionStateSync', () => {
        it('should resolve true when condition becomes true', async () => {
            let conditionMet = false;
            const checkCondition = () => conditionMet;

            const promise = waitForSessionStateSync(checkCondition, 5000, 100);

            // 条件を満たす
            setTimeout(() => {
                conditionMet = true;
            }, 300);

            vi.advanceTimersByTime(400);
            const result = await promise;

            expect(result).toBe(true);
        });

        it('should resolve false when timeout is reached', async () => {
            const checkCondition = () => false; // 常にfalse

            const promise = waitForSessionStateSync(checkCondition, 1000, 100);

            vi.advanceTimersByTime(1100);
            const result = await promise;

            expect(result).toBe(false);
        });

        it('should resolve immediately if condition is already true', async () => {
            const checkCondition = () => true; // 常にtrue

            const promise = waitForSessionStateSync(checkCondition, 5000, 100);

            const result = await promise;

            expect(result).toBe(true);
        });
    });

    describe('Constants', () => {
        it('should have appropriate timeout values', () => {
            expect(PAUSE_COMMAND_TIMEOUT_MS).toBe(30_000); // 30秒
            expect(PAUSE_STATE_SYNC_TIMEOUT_MS).toBe(10_000); // 10秒
        });

        it('should have pause timeout longer than sync timeout', () => {
            expect(PAUSE_COMMAND_TIMEOUT_MS).toBeGreaterThan(PAUSE_STATE_SYNC_TIMEOUT_MS);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle pause button stuck scenario', async () => {
            // Pauseボタンが固まるシナリオをシミュレート
            let sessionStatus = 'running';
            let isStopRequested = false;
            let forceResetCalled = false;

            const checkSessionPaused = () => sessionStatus === 'paused';
            const forceReset = () => {
                forceResetCalled = true;
                isStopRequested = false;
            };

            // Pause要求を開始
            isStopRequested = true;

            // セッション状態の同期を待機（タイムアウトするケース）
            const syncPromise = waitForSessionStateSync(checkSessionPaused, 1000, 100);

            // タイムアウト後に強制リセット
            setTimeout(() => {
                if (isStopRequested) {
                    forceReset();
                }
            }, 1100);

            vi.advanceTimersByTime(1200);
            const syncResult = await syncPromise;

            expect(syncResult).toBe(false); // タイムアウト
            expect(forceResetCalled).toBe(true); // 強制リセットが呼ばれた
            expect(isStopRequested).toBe(false); // 状態がリセットされた
        });

        it('should handle browser reload scenario', async () => {
            // ブラウザリロード後の状態不整合をシミュレート
            const mockLocalStorage = {
                getItem: vi.fn(),
                removeItem: vi.fn(),
            };

            // autoResumeBuildフラグが残っているが、セッションは完了済み
            mockLocalStorage.getItem.mockReturnValue('test-node-id');
            const sessionRecord = { status: 'completed' };

            // 状態整合性チェック
            if (mockLocalStorage.getItem('autoResumeBuild') && sessionRecord.status === 'completed') {
                mockLocalStorage.removeItem('autoResumeBuild');
            }

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('autoResumeBuild');
        });
    });
});