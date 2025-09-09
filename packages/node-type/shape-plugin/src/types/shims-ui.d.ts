// Minimal shims for UI modules referenced by shape-plugin
declare module '@hierarchidb/folder-plugin/ui' {
  export interface CategoryOption<T = string> {
    value: T;
    label: string;
    description?: string;
    icon?: any;
    color?: string;
  }
}

declare module '@hierarchidb/runtime-base-dialog' {
  import * as React from 'react';
  export const StepperDialog: React.FC<any>;

  export function useWorkingCopy<T = any>(initial?: T): [T | null, (u: Partial<T>) => void];
}
