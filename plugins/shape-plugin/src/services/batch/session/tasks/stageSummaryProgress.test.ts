import { describe, expect, it } from 'vitest';
import { buildStageSummaryProgressInfo } from './stageSummaryProgress.js';

describe('stageSummaryProgress', () => {
  it('builds ProgressInfo using computePercentage', () => {
    const p = buildStageSummaryProgressInfo({
      stage: 'extract2',
      currentTask: 'Extract2 completed',
      summary: { total: 10, completed: 7, failed: 2, skipped: 1 },
    });

    expect(p.currentStage).toBe('extract2');
    expect(p.currentTask).toBe('Extract2 completed');
    expect(p.total).toBe(10);
    expect(p.completed).toBe(7);
    expect(p.failed).toBe(2);
    expect(p.skipped).toBe(1);
    expect(p.percentage).toBe(100);
  });
});

