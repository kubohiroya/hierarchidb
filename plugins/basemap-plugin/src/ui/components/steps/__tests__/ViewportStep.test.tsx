import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
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

const originalGeolocation = global.navigator.geolocation;

afterEach(() => {
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: originalGeolocation,
  });
});

describe('ViewportStep geolocation', () => {
  it('applies geolocation coordinates when available', () => {
    const onChange = vi.fn();
    const getCurrentPosition = vi.fn().mockImplementation((success: (position: GeolocationPosition) => void) => {
      success({
        coords: {
          latitude: 33,
          longitude: 122,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    renderViewportStep({ onChange });

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [122, 33],
        pitch: 0,
        bearing: 0,
      })
    );
  });

  it('falls back to default viewport when geolocation is unavailable', () => {
    const onChange = vi.fn();
    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    renderViewportStep({ onChange });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [139.767, 35.681],
        zoom: 10,
      })
    );
  });
});
