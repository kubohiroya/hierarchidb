import type { ReactNode } from 'react';

export type SpeedDialActionType = {
  icon: ReactNode;
  name: string;
  disabled?: boolean;
  color?: string;
  onClick: (() => void) | undefined;
};
