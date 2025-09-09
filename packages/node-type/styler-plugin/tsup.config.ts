import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'shared/index': 'src/shared/index.ts',
  },
  external: [
    'provider',
    'provider-dom',
    'provider-i18next',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/ui-core',
    'dexie',
  ],
});
