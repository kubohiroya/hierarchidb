import React from 'react';
import { DateTimePicker as MuiDateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import type { HdbDateTimePickerProps } from './types/public';

export const DateTimePicker: React.FC<HdbDateTimePickerProps> = ({
  label,
  value,
  onChange,
  disabled,
  readOnly,
  minDate,
  maxDate,
  views,
  format,
  slotProps,
}) => {
  return (
    <MuiDateTimePicker
      label={label as any}
      value={value as any}
      onChange={(v) => onChange((v as unknown as Date) ?? null)}
      disabled={disabled}
      readOnly={readOnly}
      minDate={minDate as any}
      maxDate={maxDate as any}
      views={views as any}
      format={format}
      slotProps={slotProps as any}
    />
  );
};

