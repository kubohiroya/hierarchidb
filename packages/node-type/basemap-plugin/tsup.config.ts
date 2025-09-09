import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
  },
  external: [
    'provider',
    'provider-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    'dexie',
  ],
});
