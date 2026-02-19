import { describe, expect, it } from 'vitest';
import { buildShapeTaskTitle } from '~/common/utils/taskTitles';

describe('taskTitles', () => {
  it('formats transform task title as country code + level + band + zoom range', () => {
    const title = buildShapeTaskTitle({
      stage: 'transform',
      inputData: {
        countryName: 'Japan',
        countryCode: 'JP',
        adminLevel: 0,
        bandIndex: 2,
        bandMinZoom: 3,
        bandMaxZoom: 6,
      },
    });

    expect(title).toBe('Japan (JP) 0 band2 z3-6');
  });

  it('keeps explicit title when task already has title', () => {
    const title = buildShapeTaskTitle({
      stage: 'transform',
      title: 'Custom title',
      inputData: {
        countryName: 'Japan',
        countryCode: 'JP',
        adminLevel: 0,
        bandIndex: 2,
        bandMinZoom: 3,
        bandMaxZoom: 6,
      },
    });

    expect(title).toBe('Custom title');
  });
});
