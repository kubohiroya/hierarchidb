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

    fireEvent.click(screen.getByLabelText('Maximize (最大)'));
    expect(onChange).toHaveBeenNthCalledWith(1, 'maximize');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="maximize"
        onChangeDisplayMode={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Normal (通常)'));
    expect(onChange).toHaveBeenNthCalledWith(2, 'normal');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="normal"
        onChangeDisplayMode={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Full-screen (全画面)'));
    expect(onChange).toHaveBeenNthCalledWith(3, 'full-screen');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="full-screen"
        onChangeDisplayMode={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Normal (通常)'));
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
    fireEvent.click(within(menu).getByText('Maximize (最大)'));
    expect(onChange).toHaveBeenNthCalledWith(1, 'maximize');

    fireEvent.click(screen.getByLabelText('Display mode'));
    const menu2 = await screen.findByRole('menu');
    fireEvent.click(within(menu2).getByText('Full-screen (全画面)'));
    expect(onChange).toHaveBeenNthCalledWith(2, 'full-screen');
  });
});

