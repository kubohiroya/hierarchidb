import { createTsupConfig } from '../../tsup.base.config';

export default createTsupConfig({
  entry: {
    'index': 'src/index.ts',
    'database/index': 'src/services/database/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
    'ui/index': 'src/ui/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'database/index': 'src/services/database/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
      'ui/index': 'src/ui/index.ts',
    },
  },
  external: [
    'provider',
    'provider-dom',
    'provider-i18next',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/plugin-ui-sdk',
    '@hierarchidb/runtime-ui-plugin-dialog',
    // bundle internal workspace deps and non-UI libs
  ],
});
