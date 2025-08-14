import type { ReactNode } from 'react';

export type DropdownMenuItemType = {
  icon: ReactNode;
  name: string;
  disabled?: boolean;
  color?: string;
  onClick: (() => void) | undefined;
};
