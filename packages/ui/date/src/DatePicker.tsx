import React from 'react';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';

export interface HdbDatePickerProps {
  label?: React.ReactNode;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  minDate?: Date;
  maxDate?: Date;
  format?: string;
  slotProps?: {
    textField?: Record<string, unknown>;
    popper?: Record<string, unknown>;
  };
}

export const DatePicker: React.FC<HdbDatePickerProps> = ({
  label,
  value,
  onChange,
  disabled,
  readOnly,
  minDate,
  maxDate,
  format,
  slotProps,
}) => {
  return (
    <MuiDatePicker
      label={label as any}
      value={value as any}
      onChange={(v) => onChange((v as unknown as Date) ?? null)}
      disabled={disabled}
      readOnly={readOnly}
      minDate={minDate as any}
      maxDate={maxDate as any}
      format={format}
      slotProps={slotProps as any}
    />
  );
};

