import { Box, Stack } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type React from 'react';

export type BuildConfigShellProps = {
  children: React.ReactNode;
  alert?: React.ReactNode;
  padding?: number;
  spacing?: number;
  sx?: SxProps<Theme>;
};

export const BuildConfigShell: React.FC<BuildConfigShellProps> = ({
  children,
  alert,
  padding = 2,
  spacing = 2,
  sx,
}) => {
  return (
    <Box sx={{ p: padding, ...sx }}>
      <Stack spacing={spacing}>
        {alert}
        {children}
      </Stack>
    </Box>
  );
};
