import type { Theme } from '@mui/material/styles';
import { darken, lighten } from '@mui/material/styles';

const LIGHT_MODE_DARKEN = 0.04;
const DARK_MODE_LIGHTEN = 0.08;

/**
 * Returns a gently contrasted surface color for plugin/archive console that
 * keeps parity across themes while nudging the tone one step stronger.
 */
export function getDialogSurfaceColor(theme: Theme): string {
  const base = theme.palette.background.paper;
  return theme.palette.mode === 'light'
    ? darken(base, LIGHT_MODE_DARKEN)
    : lighten(base, DARK_MODE_LIGHTEN);
}
