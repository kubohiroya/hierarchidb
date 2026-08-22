import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

type TreeConsoleRouteThemeBoundaryProps = {
  treeId?: string;
  children: ReactNode;
};

export function TreeConsoleRouteThemeBoundary({
  treeId,
  children,
}: TreeConsoleRouteThemeBoundaryProps) {
  const baseTheme = useTheme();

  const themed = useMemo(() => {
    if (treeId !== 'p') {
      return baseTheme;
    }

    return createTheme(baseTheme, {
      palette: {
        primary: { ...baseTheme.palette.secondary },
        secondary: { ...baseTheme.palette.primary },
      },
    });
  }, [baseTheme, treeId]);

  if (themed === baseTheme) {
    return <>{children}</>;
  }

  return <ThemeProvider theme={themed}>{children}</ThemeProvider>;
}
