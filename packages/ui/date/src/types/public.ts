import type { ReactNode } from 'react';

export interface HdbDateTimePickerProps {
  label?: ReactNode;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  minDate?: Date;
  maxDate?: Date;
  views?: Array<'year' | 'month' | 'day' | 'hours' | 'minutes' | 'seconds'>;
  format?: string;
  /**
   * TextField and popper configurations (stable subset)
   */
  slotProps?: {
    textField?: Record<string, unknown>;
    popper?: Record<string, unknown>;
  };
}

