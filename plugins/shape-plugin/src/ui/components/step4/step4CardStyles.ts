import type { SxProps, Theme } from '@mui/material';

export const getStep4HoverCardSx = (disabled?: boolean): SxProps<Theme> => {
  if (disabled) return {};
  return {
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: (theme) => theme.shadows[8],
    },
  };
};
