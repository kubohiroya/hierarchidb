import { describe, expect, it } from 'vitest';
import { summarizeStageRecords } from './stageSummary.js';

describe('stageSummary', () => {
  it('summarizes completed/failed/skipped', () => {
    const res = summarizeStageRecords([
      { status: 'completed', message: '' },
      { status: 'completed', message: 'SKIPPED: already exists' },
      { status: 'failed', message: 'boom' },
      { status: 'regression', message: 'regression detected' },
      { status: 'completed', message: null },
    ]);

    expect(res.total).toBe(5);
    expect(res.skipped).toBe(1);
    expect(res.failed).toBe(2);
    // completed = completedCount(3) - skipped(1)
    expect(res.completed).toBe(2);
  });
});

