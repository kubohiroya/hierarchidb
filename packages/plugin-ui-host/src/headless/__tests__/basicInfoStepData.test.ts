import { describe, expect, it } from 'vitest';
import { BASIC_INFO_META_KEY, buildStepWorkingData } from '../usePluginDialogController.js';

describe('buildStepWorkingData', () => {
  it('merges basic info fields into working copy data', () => {
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

    expect(result).toMatchObject({
      draft: { foo: 'bar' },
      name: 'New Basemap',
      description: 'Default description',
      tags: ['basemap'],
    });
    expect(result.draft).toMatchObject({
      foo: 'bar',
      name: 'New Basemap',
      description: 'Default description',
    });
    expect(result[BASIC_INFO_META_KEY]).toEqual(meta);
  });

  it('creates a fresh record when working data is undefined', () => {
    const basicInfo = {
      name: 'Fallback Name',
      description: '',
      tags: [],
    };
    const meta = { error: 'Name is required', hasConflict: false };

    const result = buildStepWorkingData(undefined, basicInfo, meta);

    expect(result).toMatchObject({
      name: 'Fallback Name',
      description: '',
      tags: [],
    });
    expect(result.draft).toMatchObject({
      name: 'Fallback Name',
      description: '',
    });
    expect(result[BASIC_INFO_META_KEY]).toEqual(meta);
  });
});
