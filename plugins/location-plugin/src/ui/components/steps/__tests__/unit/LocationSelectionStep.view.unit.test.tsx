import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocationEntity } from '../../../types/index';
import type { Timestamp } from '@hierarchidb/common-types';
import { LocationSelectionStep } from '../../LocationSelectionStep';
import en from '../../../../ui/locales/en.json' with { type: 'json' };

describe('LocationSelectionStep (component)', () => {
  const timestamp = Date.now() as Timestamp;
  const baseDraft: Partial<LocationEntity> = {
    dataSource: 'openstreetmap',
    selectionMatrix: Array.from({ length: 2 }, () => Array(5).fill(false)),
    concurrentDownloads: 2,
    licenseAgreement: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  it('renders selection guidance and default location tabs', () => {
    const onUpdate = vi.fn();
    render(<LocationSelectionStep draft={baseDraft} onUpdate={onUpdate} />);

    expect(screen.getByText(en.selection.alertMessage)).toBeInTheDocument();
    expect(screen.getByText(/Region/i)).toBeInTheDocument();
    expect(screen.getByText(/Country/i)).toBeInTheDocument();
    expect(screen.getByText(en.locationTypes.airport, { exact: false })).toBeInTheDocument();
  });

  it('notifies parent via onUpdate when a matrix cell is toggled', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<LocationSelectionStep draft={baseDraft} onUpdate={onUpdate} />);

    const firstCheckbox = screen.getByRole('checkbox', { name: /Japan.*Area centroid/i });
    fireEvent.click(firstCheckbox);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0] as Partial<LocationEntity>;
    const nextMatrix = patch.selectionMatrix ?? baseDraft.selectionMatrix;
    expect(nextMatrix?.[0]?.[0]).toBe(true);

    rerender(
      <LocationSelectionStep
        draft={{ ...baseDraft, selectionMatrix: nextMatrix }}
        onUpdate={onUpdate}
      />,
    );
  });
});
