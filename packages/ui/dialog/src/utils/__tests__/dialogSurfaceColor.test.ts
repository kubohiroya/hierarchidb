import { describe, expect, it } from 'vitest';
import { createTheme, darken, lighten } from '@mui/material/styles';
import { getDialogSurfaceColor } from '~/utils/dialogSurfaceColor';

describe('getDialogSurfaceColor', () => {
  it('darkens the light theme paper colour slightly', () => {
    const baseColor = '#fafafa';
    const theme = createTheme({ palette: { mode: 'light', background: { paper: baseColor } } });
    const surface = getDialogSurfaceColor(theme);
    expect(surface).not.toBe(baseColor);
    expect(surface).toBe(darken(baseColor, 0.04));
  });

  it('lightens the dark theme paper colour slightly', () => {
    const baseColor = '#1f1f25';
    const theme = createTheme({ palette: { mode: 'dark', background: { paper: baseColor } } });
    const surface = getDialogSurfaceColor(theme);
    expect(surface).not.toBe(baseColor);
    expect(surface).toBe(lighten(baseColor, 0.08));
  });
});
