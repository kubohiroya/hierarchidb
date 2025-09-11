declare module '@hierarchidb/ui-core' {
  import type { FC, ReactNode } from 'react';
  export const DropdownMenu: FC<{ id: string; items: any[]; children?: ReactNode }>;
}

