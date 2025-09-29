import { describe, expect, it } from 'vitest';
import { buildCheckboxState } from '../LocationSelectionStep.js';
import type { LocationType } from '../../../types/index.js';
import type { Country, LocationTypeConfig } from '../../ui/SelectionMatrix.js';

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
