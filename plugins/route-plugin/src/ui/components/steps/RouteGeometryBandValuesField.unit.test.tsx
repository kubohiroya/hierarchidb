import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteGeometryBandValuesField } from './RouteGeometryBandValuesField.js';

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
  }),
}));

describe('RouteGeometryBandValuesField', () => {
  it('keeps invalid input visible without publishing repaired values', () => {
    const onValuesChange = vi.fn();
    render(
      <RouteGeometryBandValuesField
        label="Band values"
        values={[0, 5000, 10000]}
        bandCount={3}
        onValuesChange={onValuesChange}
      />
    );
    const input = screen.getByLabelText('Band values');

    fireEvent.change(input, { target: { value: '0, invalid, 10000' } });
    expect((input as HTMLInputElement).value).toBe('0, invalid, 10000');
    expect(screen.queryByText('Value 2 must be a finite non-negative number.')).not.toBeNull();
    expect(onValuesChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '0, 5000, 10000, 20000' } });
    expect((input as HTMLInputElement).value).toBe('0, 5000, 10000, 20000');
    expect(screen.queryByText('Enter exactly 3 comma-separated values.')).not.toBeNull();
    expect(onValuesChange).not.toHaveBeenCalled();
  });

  it('publishes only an exact valid band array', () => {
    const onValuesChange = vi.fn();
    render(
      <RouteGeometryBandValuesField
        label="Band values"
        values={[0, 5000, 10000]}
        bandCount={3}
        onValuesChange={onValuesChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Band values'), {
      target: { value: '1, 2500, 7500' },
    });

    expect(onValuesChange).toHaveBeenCalledOnce();
    expect(onValuesChange).toHaveBeenCalledWith([1, 2500, 7500]);
  });
});
