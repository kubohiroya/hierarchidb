import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommonDialogTitle } from '../CommonDialogTitle.js';

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
        displayMode="standard"
        onChangeDisplayMode={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('最大化'));
    expect(onChange).toHaveBeenNthCalledWith(1, 'maximized');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="maximized"
        onChangeDisplayMode={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('標準サイズに戻す'));
    expect(onChange).toHaveBeenNthCalledWith(2, 'standard');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="standard"
        onChangeDisplayMode={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('フルスクリーン'));
    expect(onChange).toHaveBeenNthCalledWith(3, 'fullscreen');

    rerender(
      <CommonDialogTitle
        {...baseProps}
        displayMode="fullscreen"
        onChangeDisplayMode={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('フルスクリーン解除'));
    expect(onChange).toHaveBeenNthCalledWith(4, 'standard');
  });

  it('allows selecting display mode from the menu', async () => {
    const onChange = vi.fn();
    render(
      <CommonDialogTitle
        {...baseProps}
        displayMode="standard"
        onChangeDisplayMode={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Display mode'));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('最大化（ウィンドウ内）'));
    expect(onChange).toHaveBeenNthCalledWith(1, 'maximized');

    fireEvent.click(screen.getByLabelText('Display mode'));
    const menu2 = await screen.findByRole('menu');
    fireEvent.click(within(menu2).getByText('フルスクリーン'));
    expect(onChange).toHaveBeenNthCalledWith(2, 'fullscreen');
  });
});

