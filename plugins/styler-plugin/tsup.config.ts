import { createTsupConfig } from "../../tsup.base.config";

export default createTsupConfig({
  entry: {
    'index': 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'shared/index': 'src/common/shared/index.ts',
    'services/index': 'src/services/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/index.ts',
      'shared/index': 'src/common/shared/index.ts',
      'services/index': 'src/services/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
    },
  },
  external: [
    '@hierarchidb/util',
    '@hierarchidb/tabular-store',
    '@hierarchidb/folder-plugin',
    '@hierarchidb/ui-csv-extract',
    '@hierarchidb/common-types',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/spreadsheet-plugin',
    '@hierarchidb/runtime-ui-plugin-dialog',
  ],
});
