import type { ComponentType } from 'react';

declare module '@hierarchidb/spreadsheet-plugin' {
  export const DataSourceStep: ComponentType<any>;
  export const FilteringStep: ComponentType<any>;
}
