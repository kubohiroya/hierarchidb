import { Theme } from '@mui/material/styles';

export const getBackgroundColorForTheme = (theme: Theme): string => {
  return theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50];
};

export const getTextColorForTheme = (theme: Theme): string => {
  return theme.palette.mode === 'dark' ? theme.palette.grey[100] : theme.palette.grey[900];
};
