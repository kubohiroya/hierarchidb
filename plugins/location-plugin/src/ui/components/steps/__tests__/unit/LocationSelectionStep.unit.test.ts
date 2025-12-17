import { describe, expect, it } from 'vitest';
import { normalizeMatrix } from '../../LocationSelectionStep';
import type { LocationType } from '../../../../common/types/index';

const mockCountries = [
  { code: 'AAA', name: 'Alpha', continent: 'Test' },
  { code: 'BBB', name: 'Beta', continent: 'Test' },
] as const;

const mockTypes = [
  { id: 'airport' as LocationType },
  { id: 'port' as LocationType },
];

describe('normalizeMatrix', () => {
  it('fills missing rows and columns with false', () => {
    const matrix = [[true], []];
    const normalized = normalizeMatrix(matrix, mockCountries, mockTypes);
    expect(normalized).toEqual([
      [true, false],
      [false, false],
    ]);
  });

  it('returns empty selections when matrix is undefined', () => {
    const normalized = normalizeMatrix(undefined, mockCountries, mockTypes);
    expect(normalized).toEqual([
      [false, false],
      [false, false],
    ]);
  });
});
