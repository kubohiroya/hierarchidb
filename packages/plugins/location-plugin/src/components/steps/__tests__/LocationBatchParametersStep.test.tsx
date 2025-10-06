import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LocationWorkingCopy } from '../../../types/index.js';
import type { Timestamp } from '@hierarchidb/common-type';
import { LocationBatchParametersStep } from '../LocationBatchParametersStep.js';
import { en } from '../../../i18n/en.js';

const timestamp = Date.now() as Timestamp;
const baseWorkingCopy: LocationWorkingCopy = {
  treeNodeId: 'node-1',
  draft: {
    concurrentDownloads: 2,
    tilesMinZoom: 4,
    tilesMaxZoom: 12,
  },
  createdAt: timestamp,
  updatedAt: timestamp,
  originalVersion: 1,
};

describe('LocationBatchParametersStep', () => {
  it('renders processing description and initial values', () => {
    const onUpdate = vi.fn();
    render(<LocationBatchParametersStep workingCopy={baseWorkingCopy} onUpdate={onUpdate} />);

    expect(screen.getByText(en.processing.description)).toBeInTheDocument();
    expect(screen.getByLabelText(en.processing.minZoom)).toHaveValue(4);
    expect(screen.getByLabelText(en.processing.maxZoom)).toHaveValue(12);
  });

  it('clamps concurrency slider changes within allowed range', () => {
    const onUpdate = vi.fn();
    render(<LocationBatchParametersStep workingCopy={baseWorkingCopy} onUpdate={onUpdate} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '20' } });

    expect(onUpdate).toHaveBeenCalledWith({ draft: { concurrentDownloads: 16 } });
  });

  it('updates min zoom and enforces max zoom floor', () => {
    const onUpdate = vi.fn();
    render(<LocationBatchParametersStep workingCopy={baseWorkingCopy} onUpdate={onUpdate} />);

    const minField = screen.getByLabelText(en.processing.minZoom);
    fireEvent.change(minField, { target: { value: '18' } });

    expect(onUpdate).toHaveBeenCalledWith({ draft: { tilesMinZoom: 18, tilesMaxZoom: 18 } });
  });

  it('updates max zoom and enforces min zoom ceiling', () => {
    const onUpdate = vi.fn();
    render(
      <LocationBatchParametersStep
        workingCopy={{
          ...baseWorkingCopy,
          draft: { ...baseWorkingCopy.draft, tilesMinZoom: 10, tilesMaxZoom: 10 },
        }}
        onUpdate={onUpdate}
      />,
    );

    const maxField = screen.getByLabelText(en.processing.maxZoom);
    fireEvent.change(maxField, { target: { value: '5' } });

    expect(onUpdate).toHaveBeenCalledWith({ draft: { tilesMinZoom: 5, tilesMaxZoom: 5 } });
  });
});
