// Minimal shims for @mui/x-date-pickers to keep typecheck green without installing the package.
// Leaf-only: this package may replace these with real deps later.
declare module '@mui/x-date-pickers/LocalizationProvider' {
  import * as React from 'react';
  export interface LocalizationProviderProps {
    dateAdapter: any;
    adapterLocale?: any;
    children?: React.ReactNode;
  }
  export const LocalizationProvider: React.FC<LocalizationProviderProps>;
  export default LocalizationProvider;
}

declare module '@mui/x-date-pickers/AdapterDateFns' {
  export class AdapterDateFns {
    constructor(...args: any[]);
  }
}

declare module '@mui/x-date-pickers/DateTimePicker' {
  import * as React from 'react';
  export interface DateTimePickerProps<TDate = Date> {
    label?: string;
    value?: TDate | null;
    onChange?: (value: TDate | null) => void;
    minDateTime?: TDate;
    maxDateTime?: TDate;
    disabled?: boolean;
    [key: string]: any;
  }
  export const DateTimePicker: React.FC<DateTimePickerProps>;
  export default DateTimePicker;
}

