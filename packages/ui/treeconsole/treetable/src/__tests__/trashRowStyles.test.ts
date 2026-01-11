import { describe, expect, it } from 'vitest';
import { createTheme } from '@mui/material/styles';
import { darken } from '@mui/material/styles';
import { getTrashRowSx } from '../components/internal/TreeTableRows.js';

describe('getTrashRowSx', () => {
  it('returns empty styles in light mode', () => {
    const theme = createTheme({ palette: { mode: 'light' } });
    expect(getTrashRowSx(theme)).toEqual({});
  });

  it('darkens the row background and hover atoms in dark mode', () => {
    const theme = createTheme({ palette: { mode: 'dark' } });
    const styles = getTrashRowSx(theme) as Record<string, unknown>;
    const expectedBase = darken(theme.palette.background.paper, 0.08);
    const expectedHover = darken(theme.palette.background.paper, 0.14);

    expect(styles.backgroundColor).toBe(expectedBase);

    const hover = styles['&:hover'] as Record<string, unknown> | undefined;
    expect(hover?.backgroundColor).toBe(expectedHover);
  });
});
