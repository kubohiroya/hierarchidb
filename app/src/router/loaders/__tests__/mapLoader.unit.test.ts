import { describe, expect, it } from 'vitest';
import { normalizeMapSearch } from '../mapLoader.js';

describe('normalizeMapSearch', () => {
  it('keeps captureIntentId on the normal map route search contract', () => {
    expect(
      normalizeMapSearch({
        zxy: '3,139.75,35.68',
        captureIntentId: 'run-1:0',
      })
    ).toEqual({
      zxy: '3,139.75,35.68',
      captureIntentId: 'run-1:0',
    });
  });

  it('drops non-string search values', () => {
    expect(
      normalizeMapSearch({
        zxy: 3,
        captureIntentId: false,
      })
    ).toEqual({
      zxy: undefined,
      captureIntentId: undefined,
    });
  });
});
