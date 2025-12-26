import { describe, expect, it } from 'vitest';
import { buildSelectionRecord } from '../../LocationSelectionStep';
import type { LocationType } from '../../../../common/types/index';

const mockCountries = [
  { code: 'AAA', name: 'Alpha', continent: 'Test' },
  { code: 'BBB', name: 'Beta', continent: 'Test' },
] as const;

const mockTypes = [
  { id: 'airport' as LocationType },
  { id: 'port' as LocationType },
];

describe('buildSelectionRecord', () => {
  it('fills missing rows and columns with false', () => {
    const selections = [
      { countryCode: 'AAA', selections: { airport: true } },
    ];
    const normalized = buildSelectionRecord(
      mockCountries,
      mockTypes,
      selections,
      new Set(mockTypes.map((type) => type.id)),
      mockTypes.map((type) => type.id),
    );
    expect(normalized).toEqual({
      AAA: [true, false],
      BBB: [false, false],
    });
  });

  it('keeps per-country selections when only one type is allowed', () => {
    const selections = [
      { countryCode: 'AAA', selections: { airport: false } },
      { countryCode: 'BBB', selections: { airport: false } },
    ];
    const normalized = buildSelectionRecord(
      mockCountries,
      [{ id: 'airport' as LocationType }],
      selections,
      new Set<LocationType>(['airport']),
    );
    expect(normalized).toEqual({
      AAA: [false],
      BBB: [false],
    });
  });
});
