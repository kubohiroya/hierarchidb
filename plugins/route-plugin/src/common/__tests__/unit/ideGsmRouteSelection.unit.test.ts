import {
  buildIdeGsmRouteSelectionEntries,
  IDE_GSM_ROUTE_SELECTION_ROW_LENGTH,
  ROUTE_MODES,
} from '@hierarchidb/route-api';
import { describe, expect, it } from 'vitest';

describe('buildIdeGsmRouteSelectionEntries', () => {
  it('maps strict ten-cell country rows into deterministic OR/AND entries', () => {
    expect(
      buildIdeGsmRouteSelectionEntries({
        US: [false, true, false, false, false, false, true, false, false, false],
        JP: [true, false, false, false, true, true, false, false, false, true],
      })
    ).toEqual([
      {
        countryCode: 'JP',
        orModes: [ROUTE_MODES.AIRWAY, ROUTE_MODES.ROAD],
        andModes: [ROUTE_MODES.AIRWAY, ROUTE_MODES.ROAD],
      },
      {
        countryCode: 'US',
        orModes: [ROUTE_MODES.WATERWAY],
        andModes: [ROUTE_MODES.WATERWAY],
      },
    ]);
  });

  it('omits unselected countries and rejects an all-empty selection', () => {
    const emptyRow = Array.from({ length: IDE_GSM_ROUTE_SELECTION_ROW_LENGTH }, () => false);

    expect(() =>
      buildIdeGsmRouteSelectionEntries({
        JP: emptyRow,
      })
    ).toThrow('selectedArrayByCountries has no selected routes');
  });

  it('rejects legacy five-cell rows', () => {
    expect(() =>
      buildIdeGsmRouteSelectionEntries({
        JP: [true, false, false, false, false],
      })
    ).toThrow('selection row for JP must contain exactly 10 boolean cells');
  });

  it('rejects malformed country codes and cells', () => {
    expect(() =>
      buildIdeGsmRouteSelectionEntries({
        jp: Array.from({ length: IDE_GSM_ROUTE_SELECTION_ROW_LENGTH }, () => true),
      })
    ).toThrow('country code must be an uppercase ISO 3166-1 alpha-2 code');

    expect(() =>
      buildIdeGsmRouteSelectionEntries({
        JP: [true, false, false, false, false, true, false, false, false, 'yes'],
      })
    ).toThrow('selection row for JP cell 9 must be boolean');
  });

  it('rejects OR selections that do not include the matching AND cell', () => {
    expect(() =>
      buildIdeGsmRouteSelectionEntries({
        JP: [true, false, false, false, false, false, false, false, false, false],
      })
    ).toThrow('OR selection for JP/airway requires the matching AND cell to be true');
  });
});
