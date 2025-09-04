import React from 'react';
import { TimePicker as MuiTimePicker } from '@mui/x-date-pickers/TimePicker';

export interface HdbTimePickerProps {
  label?: React.ReactNode;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  minTime?: Date;
  maxTime?: Date;
  ampm?: boolean;
  format?: string;
  slotProps?: {
    textField?: Record<string, unknown>;
    popper?: Record<string, unknown>;
  };
}

export const TimePicker: React.FC<HdbTimePickerProps> = ({
  label,
  value,
  onChange,
  disabled,
  readOnly,
  minTime,
  maxTime,
  ampm,
  format,
  slotProps,
}) => {
  return (
    <MuiTimePicker
      label={label as any}
      value={value as any}
      onChange={(v) => onChange((v as unknown as Date) ?? null)}
      disabled={disabled}
      readOnly={readOnly}
      minTime={minTime as any}
      maxTime={maxTime as any}
      ampm={ampm}
      format={format as any}
      slotProps={slotProps as any}
    />
  );
};

