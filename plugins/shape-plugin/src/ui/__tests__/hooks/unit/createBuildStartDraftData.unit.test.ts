import { describe, expect, it } from 'vitest';
import { createBuildStartDraftData } from '../../../components/build-progress/createBuildStartDraftData.ts';

describe('createBuildStartDraftData', () => {
  it('persists live selection when current draft does not have selection', () => {
    const next = createBuildStartDraftData({
      currentDraftData: {
        buildConfig: { dataSourceName: 'gadm41' },
      },
      liveData: {
        selectedArrayByCountries: {
          JP: [true, false, false],
        },
      },
    });

    expect(next.selectedArrayByCountries).toEqual({
      JP: [true, false, false],
    });
  });

  it('prefers patch selection over live selection', () => {
    const next = createBuildStartDraftData({
      currentDraftData: {
        selectedArrayByCountries: {
          JP: [true, false, false],
        },
      },
      liveData: {
        selectedArrayByCountries: {
          JP: [true, true, false],
        },
      },
      patch: {
        selectedArrayByCountries: {
          JP: [false, true, false],
        },
      },
    });

    expect(next.selectedArrayByCountries).toEqual({
      JP: [false, true, false],
    });
  });
});
