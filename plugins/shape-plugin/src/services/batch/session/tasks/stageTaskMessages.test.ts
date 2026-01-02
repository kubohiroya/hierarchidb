import { describe, expect, it } from 'vitest';
import { getDefaultStageMessages } from './stageTaskMessages.js';

describe('stageTaskMessages', () => {
  it('returns defaults for known stages', () => {
    expect(getDefaultStageMessages('extract1')).toEqual({
      taskQueuedMessage: 'Extract1 tasks queued',
      alreadyCompletedMessage: 'Extract1 already completed',
      completedMessage: 'Extract1 completed',
    });

    expect(getDefaultStageMessages('vectortile')).toEqual({
      taskQueuedMessage: 'Vector tile tasks queued',
      alreadyCompletedMessage: 'Vector tiles already completed',
      completedMessage: 'Vector tiles completed',
    });
  });
});

