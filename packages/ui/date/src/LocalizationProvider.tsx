import React from 'react';
import { LocalizationProvider as MuiLocalizationProvider } from '@mui/x-date-pickers';

export interface HdbLocalizationProviderProps {
  dateAdapter: any;
  adapterLocale?: unknown;
  children: React.ReactNode;
}

export const LocalizationProvider: React.FC<HdbLocalizationProviderProps> = ({
  dateAdapter,
  adapterLocale,
  children,
}) => {
  return (
    <MuiLocalizationProvider dateAdapter={dateAdapter as any} adapterLocale={adapterLocale as any}>
      {children}
    </MuiLocalizationProvider>
  );
};

