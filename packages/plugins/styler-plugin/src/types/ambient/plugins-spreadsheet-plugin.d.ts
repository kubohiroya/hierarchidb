import type { ComponentType } from 'react';

declare module '@hierarchidb/plugins-spreadsheet-plugin' {
  export const DataSourceStep: ComponentType<any>;
  export const FilteringStep: ComponentType<any>;
}
