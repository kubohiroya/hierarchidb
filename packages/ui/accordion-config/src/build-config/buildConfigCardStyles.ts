import type { SxProps, Theme } from '@mui/material';

export const getBuildConfigHoverCardSx = (
  disabled?: boolean,
  disableLift = false
): SxProps<Theme> => {
  if (disabled) return {};
  if (disableLift) return {};
  return {
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: (theme) => theme.shadows[8],
    },
  };
};
