import { describe, expect, it } from 'vitest';
import type { TaskDisplayPayload } from '@hierarchidb/build-api';
import { formatTaskDisplayMessage } from '~/ui/components/build-progress/formatTaskDisplayMessage';

const fallbackTranslator = (_key: string, fallback?: string): string => fallback ?? _key;

describe('formatTaskDisplayMessage phase fallback', () => {
  it('appends retry attempt count for retry-simplify-feature progress fallback', () => {
    const display: TaskDisplayPayload = {
      kind: 'phase',
      phaseCode: 'retry-simplify-feature',
      phaseState: 'progress',
      params: {
        attempt: 3,
        attemptTotal: 24,
      },
    };

    const message = formatTaskDisplayMessage(display, fallbackTranslator);
    expect(message).toBe('retry simplify feature progress: 3');
  });

  it('keeps generic fallback format for non-retry phases', () => {
    const display: TaskDisplayPayload = {
      kind: 'phase',
      phaseCode: 'decode',
      phaseState: 'progress',
    };

    const message = formatTaskDisplayMessage(display, fallbackTranslator);
    expect(message).toBe('decode progress');
  });
});

