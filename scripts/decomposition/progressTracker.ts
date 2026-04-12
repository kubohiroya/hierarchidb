// ============================================================
// ProgressTracker -- tracks decomposition progress across sessions.
// ============================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProgressState } from './types.js';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/** Return a fresh ProgressState with all counters at zero. */
function initialState(): ProgressState {
    return {
        completedFiles: [],
        totalTargetFiles: 0,
        remainingCount: 0,
        lastUpdated: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load progress from a tracking file.
 *
 * If the file does not exist or contains invalid JSON, an initial
 * (empty) ProgressState is returned instead.
 */
export function loadProgress(trackingFilePath: string): ProgressState {
    try {
        const raw = fs.readFileSync(trackingFilePath, 'utf-8');
        return JSON.parse(raw) as ProgressState;
    } catch {
        return initialState();
    }
}

/**
 * Save progress to a tracking file.
 *
 * Parent directories are created automatically.  If the write fails
 * a warning is logged to stderr but no error is thrown.
 */
export function saveProgress(
    state: ProgressState,
    trackingFilePath: string,
): void {
    try {
        const dir = path.dirname(trackingFilePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(trackingFilePath, JSON.stringify(state, null, 2));
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : String(err);
        process.stderr.write(
            `[progressTracker] Warning: failed to save progress – ${message}\n`,
        );
    }
}

/**
 * Mark a file as completed.
 *
 * If the file is already recorded in `completedFiles` the state is
 * returned unchanged.  Otherwise a new ProgressState is returned with
 * the file appended and `remainingCount` recalculated.
 */
export function markCompleted(
    state: ProgressState,
    filePath: string,
): ProgressState {
    if (state.completedFiles.includes(filePath)) {
        return state;
    }

    const completedFiles = [...state.completedFiles, filePath];
    return {
        completedFiles,
        totalTargetFiles: state.totalTargetFiles,
        remainingCount: state.totalTargetFiles - completedFiles.length,
        lastUpdated: new Date().toISOString(),
    };
}
