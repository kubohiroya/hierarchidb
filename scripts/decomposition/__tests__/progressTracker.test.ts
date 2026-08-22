import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProgress, markCompleted, saveProgress } from '../progressTracker.js';
import type { ProgressState } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'progress-tracker-'));
}

function makeState(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    completedFiles: [],
    totalTargetFiles: 10,
    remainingCount: 10,
    lastUpdated: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadProgress
// ---------------------------------------------------------------------------

describe('loadProgress', () => {
  it('returns initial state when file does not exist', () => {
    const state = loadProgress('/nonexistent/path/progress.json');
    expect(state.completedFiles).toEqual([]);
    expect(state.totalTargetFiles).toBe(0);
    expect(state.remainingCount).toBe(0);
    expect(state.lastUpdated).toBeTruthy();
  });

  it('parses valid JSON from an existing file', () => {
    const tmpDir = makeTmpDir();
    const filePath = path.join(tmpDir, 'progress.json');
    const saved: ProgressState = makeState({
      completedFiles: ['src/a.ts', 'src/b.ts'],
      totalTargetFiles: 5,
      remainingCount: 3,
    });
    fs.writeFileSync(filePath, JSON.stringify(saved, null, 2));

    const loaded = loadProgress(filePath);
    expect(loaded.completedFiles).toEqual(['src/a.ts', 'src/b.ts']);
    expect(loaded.totalTargetFiles).toBe(5);
    expect(loaded.remainingCount).toBe(3);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns initial state when file contains invalid JSON', () => {
    const tmpDir = makeTmpDir();
    const filePath = path.join(tmpDir, 'progress.json');
    fs.writeFileSync(filePath, '{ broken json !!!');

    const state = loadProgress(filePath);
    expect(state.completedFiles).toEqual([]);
    expect(state.totalTargetFiles).toBe(0);
    expect(state.remainingCount).toBe(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// saveProgress
// ---------------------------------------------------------------------------

describe('saveProgress', () => {
  it('writes state as formatted JSON to the given path', () => {
    const tmpDir = makeTmpDir();
    const filePath = path.join(tmpDir, 'progress.json');
    const state = makeState({ completedFiles: ['src/x.ts'] });

    saveProgress(state, filePath);

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ProgressState;
    expect(parsed.completedFiles).toEqual(['src/x.ts']);
    expect(parsed.totalTargetFiles).toBe(10);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates parent directories if they do not exist', () => {
    const tmpDir = makeTmpDir();
    const filePath = path.join(tmpDir, 'nested', 'deep', 'progress.json');

    saveProgress(makeState(), filePath);

    expect(fs.existsSync(filePath)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('logs warning to stderr on write failure without throwing', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Attempt to write to a path that cannot be created (empty string dir).
    // On most OSes writing to '/' root will fail for non-root users.
    // We use a path that is very likely to fail.
    saveProgress(makeState(), '/dev/null/impossible/progress.json');

    expect(stderrSpy).toHaveBeenCalled();
    const written = stderrSpy.mock.calls[0]?.[0];
    expect(String(written)).toContain('[progressTracker] Warning');

    stderrSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// markCompleted
// ---------------------------------------------------------------------------

describe('markCompleted', () => {
  it('adds a new file to completedFiles and updates remainingCount', () => {
    const state = makeState({ totalTargetFiles: 5, remainingCount: 5 });
    const next = markCompleted(state, 'src/a.ts');

    expect(next.completedFiles).toEqual(['src/a.ts']);
    expect(next.remainingCount).toBe(4);
    expect(next.totalTargetFiles).toBe(5);
  });

  it('returns state unchanged when file is already completed', () => {
    const state = makeState({
      completedFiles: ['src/a.ts'],
      totalTargetFiles: 5,
      remainingCount: 4,
    });
    const next = markCompleted(state, 'src/a.ts');

    expect(next).toBe(state); // same reference
  });

  it('correctly computes remainingCount after multiple marks', () => {
    let state = makeState({ totalTargetFiles: 3, remainingCount: 3 });
    state = markCompleted(state, 'src/a.ts');
    state = markCompleted(state, 'src/b.ts');
    state = markCompleted(state, 'src/c.ts');

    expect(state.completedFiles).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(state.remainingCount).toBe(0);
  });

  it('updates lastUpdated timestamp', () => {
    const state = makeState({ lastUpdated: '2020-01-01T00:00:00.000Z' });
    const next = markCompleted(state, 'src/new.ts');

    expect(next.lastUpdated).not.toBe('2020-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: save → load
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('preserves state through save and load', () => {
    const tmpDir = makeTmpDir();
    const filePath = path.join(tmpDir, 'rt.json');
    const original = makeState({
      completedFiles: ['src/a.ts', 'src/b.ts'],
      totalTargetFiles: 10,
      remainingCount: 8,
    });

    saveProgress(original, filePath);
    const restored = loadProgress(filePath);

    expect(restored.completedFiles).toEqual(original.completedFiles);
    expect(restored.totalTargetFiles).toBe(original.totalTargetFiles);
    expect(restored.remainingCount).toBe(original.remainingCount);
    expect(restored.lastUpdated).toBe(original.lastUpdated);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
