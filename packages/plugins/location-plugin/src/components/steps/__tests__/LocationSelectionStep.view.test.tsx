import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocationWorkingCopy } from '../../../types/index.js';
import type { Timestamp } from '@hierarchidb/common-type';
import { LocationSelectionStep } from '../LocationSelectionStep.js';
import { en } from '../../../i18n/en.js';

describe('LocationSelectionStep (component)', () => {
  const timestamp = Date.now() as Timestamp;
  const baseWorkingCopy: LocationWorkingCopy = {
    treeNodeId: 'node-1',
    draft: {
      dataSource: 'openstreetmap',
      selectionMatrix: [[false, false], [false, false]],
      concurrentDownloads: 2,
      licenseAgreement: false,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    originalVersion: 1,
  };

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
    const { rerender } = render(<LocationSelectionStep workingCopy={baseWorkingCopy} onUpdate={onUpdate} />);

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const patch = onUpdate.mock.calls[0][0] as Partial<LocationWorkingCopy>;
    const nextMatrix = patch.draft?.selectionMatrix ?? baseWorkingCopy.draft.selectionMatrix;
    expect(nextMatrix?.[0]?.[0]).toBe(true);

    rerender(
      <LocationSelectionStep
        workingCopy={{
          ...baseWorkingCopy,
          draft: {
            ...baseWorkingCopy.draft,
            selectionMatrix: nextMatrix,
          },
        }}
        onUpdate={onUpdate}
      />,
    );

    // selected count derivation reflects new matrix summary label
    const selectedLabel = screen.getByText((content) => content.startsWith(en.selection.selectedCount));
    expect(selectedLabel.textContent).toContain('1');
  });
});
