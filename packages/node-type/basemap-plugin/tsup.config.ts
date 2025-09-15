import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'worker/index': 'src/worker/index.ts',
    'database/index': 'src/database/index.ts',
  },
  external: [
    'provider',
    'provider-dom',
    'react',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/provider',
    '@emotion/styled',
    'dexie',
  ],
});
