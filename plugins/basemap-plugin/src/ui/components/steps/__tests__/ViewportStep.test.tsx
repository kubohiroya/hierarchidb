import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MapStyle } from '../../../../common/types/BaseMapEntity.js';
import { ViewportStep } from '../ViewportStep.js';

const renderViewportStep = (options: {
  value?: undefined;
  onChange: (next: unknown) => void;
  mapStyle?: MapStyle;
}) =>
  render(
    <ViewportStep
      value={options.value}
      mapStyle={options.mapStyle}
      onChange={options.onChange}
      mode="create"
    />
  );

describe('ViewportStep', () => {
  it('renders fallback values when no viewport is provided', () => {
    const onChange = vi.fn();
    renderViewportStep({ onChange });

    expect((screen.getByLabelText(/Longitude/i) as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText(/Latitude/i) as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText(/Zoom/i) as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText(/Bearing/i) as HTMLInputElement).value).toBe('0');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders provided viewport values', () => {
    const onChange = vi.fn();
    renderViewportStep({
      onChange,
      value: { center: [120, 30], zoom: 5, bearing: 45, pitch: 0 },
    });

    expect((screen.getByLabelText(/Longitude/i) as HTMLInputElement).value).toBe('120');
    expect((screen.getByLabelText(/Latitude/i) as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText(/Zoom/i) as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText(/Bearing/i) as HTMLInputElement).value).toBe('45');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits onChange when inputs change', () => {
    const onChange = vi.fn();
    renderViewportStep({
      onChange,
      value: { center: [10, 20], zoom: 3, bearing: 0, pitch: 0 },
    });

    fireEvent.change(screen.getByLabelText(/Zoom/i), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [10, 20],
        zoom: 4,
        bearing: 0,
      })
    );
  });
});
