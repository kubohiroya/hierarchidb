import type { TabularTableMetadata } from '@hierarchidb/tabular-store';

declare module '@hierarchidb/ui-tabular-extract' {
  interface UseTabularDataResult {
    tabularTableMetadata: TabularTableMetadata | null;
  }
}
