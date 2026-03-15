import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocationEntity } from '../../../types/index';
import type { Timestamp } from '@hierarchidb/core-types';
import { LocationSelectionStep } from '../../LocationSelectionStep';

vi.mock('@hierarchidb/ui-country-select', () => ({
  useIsoCountries: () => ({
    status: 'ready',
    countries: [{ code: 'JP', name: 'Japan', continent: 'Asia' }],
  }),
  CountryMatrixSelector: ({ matrixConfig, onSelectionsChange }: { matrixConfig: { columns: { id: string; label: string }[] }; onSelectionsChange: (value: any) => void }) => (
    <div>
      <div>{matrixConfig.columns[0]?.label}</div>
      <button
        type="button"
        aria-label="toggle-selection"
        onClick={() => onSelectionsChange([{ countryCode: 'JP', selections: { [matrixConfig.columns[0]?.id ?? '']: true } }])}
      >
        toggle
      </button>
    </div>
  ),
}));

describe('LocationSelectionStep (component)', () => {
  const timestamp = Date.now() as Timestamp;
  const baseDraft: Partial<LocationEntity> = {
    dataSource: 'openstreetmap',
    selectedArrayByCountries: {
      JP: Array(5).fill(false),
    },
    concurrentDownloads: 2,
    licenseAgreement: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  it('renders selection guidance and default location tabs', () => {
    const onUpdate = vi.fn();
    render(<LocationSelectionStep draft={baseDraft} onUpdate={onUpdate} />);

    // t() returns the key in test environment (i18next not initialized); verify the key is rendered
    expect(screen.getByText('area_centroid', { exact: false })).toBeInTheDocument();
  });

  it('notifies parent via onUpdate when a matrix cell is toggled', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<LocationSelectionStep draft={baseDraft} onUpdate={onUpdate} />);

    const toggleButton = screen.getByRole('button', { name: /toggle-selection/i });
    fireEvent.click(toggleButton);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0] as Partial<LocationEntity>;
    const nextSelections = patch.selectedArrayByCountries ?? baseDraft.selectedArrayByCountries ?? {};
    const selectedRow = Object.values(nextSelections).find((row) => row?.some(Boolean));
    expect(selectedRow?.[0]).toBe(true);

    rerender(
      <LocationSelectionStep
        draft={{ ...baseDraft, selectedArrayByCountries: nextSelections }}
        onUpdate={onUpdate}
      />,
    );
  });
});
