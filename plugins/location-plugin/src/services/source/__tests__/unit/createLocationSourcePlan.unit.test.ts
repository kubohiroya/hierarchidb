import { describe, expect, it } from 'vitest';
import { createLocationSourcePlan } from '../../createLocationSourcePlan.js';

describe('createLocationSourcePlan', () => {
  it('creates a deterministic network source plan from a country/type matrix', () => {
    const plan = createLocationSourcePlan({
      dataSource: 'ourairports',
      selectedArrayByCountries: {
        US: [false, true, false, false, false],
        JP: [false, true, false, false, false],
      },
    });

    expect(plan).toMatchObject({
      sourceKind: 'network',
      dataSource: 'ourairports',
      selection: [
        { countryCode: 'JP', types: ['airport'] },
        { countryCode: 'US', types: ['airport'] },
      ],
      identity: {
        sourceKind: 'network',
        dataSource: 'ourairports',
        authScope: 'location',
        parserVersion: 'ourairports-csv-v1',
        selectionSignature: 'JP:airport|US:airport',
      },
    });
    expect(plan.identity.inputHash).toMatch(/^locsrc:[0-9a-f]{16}$/);
  });

  it('rejects non-canonical source ids instead of falling back', () => {
    expect(() =>
      createLocationSourcePlan({
        dataSource: 'ide-gsm',
        selectedArrayByCountries: {
          JP: [true, false, false, false, false],
        },
      })
    ).toThrow('does not have a canonical Worker source strategy');
  });

  it('rejects malformed selection rows before task creation', () => {
    expect(() =>
      createLocationSourcePlan({
        dataSource: 'openstreetmap',
        selectedArrayByCountries: {
          jp: [true, false, false, false, false],
        },
      })
    ).toThrow('must be an uppercase ISO 3166-1 alpha-2 code: jp');
  });
});
