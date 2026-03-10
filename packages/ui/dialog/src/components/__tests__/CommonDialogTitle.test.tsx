import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommonDialogTitle } from '../CommonDialogTitle';

const baseProps = {
  title: 'Example Dialog',
  onClose: vi.fn(),
  showDisplayModeControls: true,
};

describe('CommonDialogTitle', () => {
  it('triggers display mode quick toggles', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CommonDialogTitle
        {...baseProps}
        displayMode="normal"
        onChangeDisplayMode={onChange}
      />,
    );

    // normal → maximize: label is "Maximize" (fallback)
    fireEvent.click(screen.getByLabelText('Maximize'));
    expect(onChange).toHaveBeenNthCalledWith(1, 'maximize');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="maximize"
        onChangeDisplayMode={onChange}
      />,
    );
    // maximize → normal: label is "Restore" (fallback)
    fireEvent.click(screen.getByLabelText('Restore'));
    expect(onChange).toHaveBeenNthCalledWith(2, 'normal');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="normal"
        onChangeDisplayMode={onChange}
      />,
    );
    // normal → full-screen: label is "Full screen" (fallback)
    fireEvent.click(screen.getByLabelText('Full screen'));
    expect(onChange).toHaveBeenNthCalledWith(3, 'full-screen');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="full-screen"
        onChangeDisplayMode={onChange}
      />,
    );
    // full-screen → normal: label is "Exit full screen" (fallback)
    fireEvent.click(screen.getByLabelText('Exit full screen'));
    expect(onChange).toHaveBeenNthCalledWith(4, 'normal');
  });

  it('allows selecting display mode from the menu', async () => {
    const onChange = vi.fn();
    render(
      <CommonDialogTitle
        {...baseProps}
        displayMode="normal"
        onChangeDisplayMode={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Display mode'));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Maximize'));
    expect(onChange).toHaveBeenNthCalledWith(1, 'maximize');

    fireEvent.click(screen.getByLabelText('Display mode'));
    const menu2 = await screen.findByRole('menu');
    fireEvent.click(within(menu2).getByText('Full screen'));
    expect(onChange).toHaveBeenNthCalledWith(2, 'full-screen');
  });
});
