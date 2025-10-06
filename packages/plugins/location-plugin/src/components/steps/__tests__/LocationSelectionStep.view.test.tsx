import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocationWorkingCopy } from '../../../types/index.js';
import { LocationSelectionStep } from '../LocationSelectionStep.js';
import { en } from '../../../i18n/en.js';

describe('LocationSelectionStep (component)', () => {
  const baseWorkingCopy: LocationWorkingCopy = {
    id: 'node-1',
    nodeId: 'node-1',
    version: 1,
    dataSource: 'openstreetmap',
    selectionMatrix: [[false, false], [false, false]],
    concurrentDownloads: 2,
    licenseAgreement: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: {
      draft: {
        selectionMatrix: [[false, false], [false, false]],
      },
    },
  } as unknown as LocationWorkingCopy;

  it('renders selection guidance and default location tabs', () => {
    const onUpdate = vi.fn();
    render(<LocationSelectionStep workingCopy={baseWorkingCopy} onUpdate={onUpdate} />);

    expect(screen.getByText(en.selection.alertMessage)).toBeInTheDocument();
    expect(screen.getByText(en.selection.matrixTitle)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: en.locationTypes.airport })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: en.locationTypes.railway_station })).toBeInTheDocument();
  });

  it('notifies parent via onUpdate when a matrix cell is toggled', () => {
    const onUpdate = vi.fn();
    render(<LocationSelectionStep workingCopy={baseWorkingCopy} onUpdate={onUpdate} />);

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0];
    expect(patch.selectionMatrix?.[0]?.[0]).toBe(true);

    // selected count derivation reflects new matrix summary label
    const selectedLabel = screen.getByText((content) => content.startsWith(en.selection.selectedCount));
    expect(selectedLabel.textContent).toContain('1');
  });
});
