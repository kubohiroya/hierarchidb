import { describe, expect, it } from 'vitest';
import { BASIC_INFO_META_KEY, buildStepWorkingData } from '../usePluginDialogController.js';

describe('buildStepWorkingData', () => {
  it('leaves step data untouched (basic info is not merged into plugin data)', () => {
    const draftData = {
      draft: {
        foo: 'bar',
        name: 'Old Name',
        description: 'Old Description',
      },
    };
    const basicInfo = {
      name: 'New Basemap',
      description: 'Default description',
      tags: ['basemap'],
    };
    const meta = { error: null, hasConflict: false };

    const result = buildStepWorkingData(draftData, basicInfo, meta);

    // Basic info fields are no longer merged into step data.
    expect(result).toEqual(draftData);
    expect(result[BASIC_INFO_META_KEY]).toBeUndefined(); // meta key is reserved but not emitted
  });

  it('returns empty object when working data is undefined', () => {
    const basicInfo = {
      name: 'Fallback Name',
      description: '',
      tags: [],
    };
    const meta = { error: 'Name is required', hasConflict: false };

    const result = buildStepWorkingData(undefined, basicInfo, meta);

    expect(result).toEqual({});
    expect(result[BASIC_INFO_META_KEY]).toBeUndefined(); // meta key is reserved but not emitted
  });
});
