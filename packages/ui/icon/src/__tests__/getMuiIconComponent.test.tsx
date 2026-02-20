import type { SvgIconProps } from '@mui/material/SvgIcon';
import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import {
  getMuiIconComponent,
  getMuiIconWithColor,
  setGlobalMuiIconMap,
} from '../getMuiIconComponent';

describe('getMuiIconComponent', () => {
  it('prefers custom icon components registered under raw names before normalization', () => {
    const CustomIcon = (_props: SvgIconProps) => <svg data-testid="custom-icon" />;
    setGlobalMuiIconMap({ Location: CustomIcon });

    const node = getMuiIconComponent('Location');

    expect(isValidElement(node)).toBe(true);
    if (!node || !isValidElement(node)) {
      throw new Error('Expected a React element');
    }
    expect(node.type).toBe(CustomIcon);
  });

  it('passes color props through when using getMuiIconWithColor with custom icons', () => {
    const CustomIcon = (_props: SvgIconProps) => <svg data-testid="custom-icon" />;
    setGlobalMuiIconMap({ Spreadsheet: CustomIcon });

    const color = '#123456';
    const node = getMuiIconWithColor('Spreadsheet', undefined, color);

    expect(isValidElement(node)).toBe(true);
    if (!node || !isValidElement(node)) {
      throw new Error('Expected a React element');
    }
    expect(node.type).toBe(CustomIcon);
    expect(node.props.sx).toEqual({ color });
  });
});
