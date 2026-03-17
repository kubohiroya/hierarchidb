/**
 * Shared utilities for resolving progress counts and percentage from BuildProgressPayload.
 *
 * Contract: payload must be present and contain finite numeric values.
 * Absent or non-finite values are treated as contract violations and throw.
 */

import type { BuildUnifiedProgressInfo } from './isBuildControlAPIV2Enabled.js';

export interface ProgressPayloadCounts {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
}

/**
 * Resolves progress counts from a BuildUnifiedProgressInfo payload.
 * Throws if payload is absent or any required field is not a finite number.
 */
export const resolveProgressPayloadCounts = (
    info: BuildUnifiedProgressInfo,
): ProgressPayloadCounts => {
    const payload = info.payload as Record<string, unknown> | undefined;
    if (!payload) {
        throw new Error(
            `[resolveProgressPayloadCounts] payload is required but was absent (nodeId=${String(info.nodeId)}, stage=${String(info.stage)})`,
        );
    }
    const readFinite = (key: string): number => {
        const value = payload[key];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error(
                `[resolveProgressPayloadCounts] payload.${key} must be a finite number, received ${String(value)} (nodeId=${String(info.nodeId)}, stage=${String(info.stage)})`,
            );
        }
        return value;
    };
    const skippedRaw = payload.skipped;
    const skipped =
        typeof skippedRaw === 'number' && Number.isFinite(skippedRaw) ? skippedRaw : 0;
    return {
        total: readFinite('total'),
        completed: readFinite('completed'),
        failed: readFinite('failed'),
        skipped,
    };
};

/**
 * Resolves the progress percentage from a BuildUnifiedProgressInfo payload.
 * Uses (completed + failed + skipped) / total * 100, consistent with computePercentage.
 * Throws if payload is absent or required fields are not finite numbers.
 */
export const resolveProgressPercentage = (info: BuildUnifiedProgressInfo): number => {
    const counts = resolveProgressPayloadCounts(info);
    const done = counts.completed + counts.failed + counts.skipped;
    return counts.total > 0 ? Math.round((done / counts.total) * 100) : 0;
};
