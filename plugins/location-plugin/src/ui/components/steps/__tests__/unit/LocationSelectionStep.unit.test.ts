import { describe, expect, it } from 'vitest';
import { buildCheckboxState, normalizeMatrix } from '../../LocationSelectionStep';
import type { LocationType } from '../../../../_obsolate_common/types/index';
import type { Country, LocationTypeConfig } from '../../LocationSelectionStep';

const mockCountries: Country[] = [
  { code: 'AAA', name: 'Alpha', continent: 'Test' },
  { code: 'BBB', name: 'Beta', continent: 'Test' },
];

const mockTypes: LocationTypeConfig[] = [
  { id: 'airport' as LocationType, name: 'Airport', icon: '✈️', color: '#000', description: 'Airport' },
  { id: 'port' as LocationType, name: 'Port', icon: '🚢', color: '#111', description: 'Port' },
];

describe('buildCheckboxState', () => {
  it('returns empty object when no selection exists', () => {
    const matrix = [
      [false, false],
      [false, false],
    ];
    expect(buildCheckboxState(matrix, mockCountries, mockTypes)).toEqual({});
  });

  it('maps selected cells to country/type combinations', () => {
    const matrix = [
      [true, false],
      [false, true],
    ];
    expect(buildCheckboxState(matrix, mockCountries, mockTypes)).toEqual({
      AAA: { airport: true },
      BBB: { port: true },
    });
  });

  it('ignores out-of-range indices gracefully', () => {
    const matrix = [
      [true, true, true],
      [false, true, false],
      [true],
    ];
    const result = buildCheckboxState(matrix, mockCountries, mockTypes);
    expect(result).toEqual({
      AAA: { airport: true, port: true },
      BBB: { port: true },
    });
  });
});

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
