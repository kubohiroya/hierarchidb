import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationEntity } from '../../../types/index';
import { LocationBatchParametersStep } from '../../LocationBatchParametersStep';
import en from '../../../../locales/en.json' with { type: 'json' };

const baseDraft: Partial<LocationEntity> = {
  concurrentDownloads: 2,
  tilesMinZoom: 4,
  tilesMaxZoom: 12,
};

describe('LocationBatchParametersStep', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });
  });

  it('renders processing description and initial values', () => {
    const onUpdate = vi.fn();
    render(<LocationBatchParametersStep draft={baseDraft} onUpdate={onUpdate} />);

    expect(screen.getByText(en.processing.description)).not.toBeNull();
    expect(Number((screen.getByLabelText(en.processing.minZoom) as HTMLInputElement).value)).toBe(4);
    expect(Number((screen.getByLabelText(en.processing.maxZoom) as HTMLInputElement).value)).toBe(12);
  });

  it('clamps concurrency slider changes within allowed range', () => {
    const onUpdate = vi.fn();
    render(<LocationBatchParametersStep draft={baseDraft} onUpdate={onUpdate} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '20' } });

    expect(onUpdate).toHaveBeenCalledWith({ concurrentDownloads: 16 });
  });

  it('updates min zoom and enforces max zoom floor', () => {
    const onUpdate = vi.fn();
    render(<LocationBatchParametersStep draft={baseDraft} onUpdate={onUpdate} />);

    const minField = screen.getByLabelText(en.processing.minZoom);
    fireEvent.change(minField, { target: { value: '18' } });

    expect(onUpdate).toHaveBeenCalledWith({ tilesMinZoom: 18, tilesMaxZoom: 18 });
  });

  it('updates max zoom and enforces min zoom ceiling', () => {
    const onUpdate = vi.fn();
    render(
      <LocationBatchParametersStep
        draft={{
          ...baseDraft,
          tilesMinZoom: 10,
          tilesMaxZoom: 10,
        }}
        onUpdate={onUpdate}
      />,
    );

    const maxField = screen.getByLabelText(en.processing.maxZoom);
    fireEvent.change(maxField, { target: { value: '5' } });

    expect(onUpdate).toHaveBeenCalledWith({ tilesMinZoom: 5, tilesMaxZoom: 5 });
  });
});
