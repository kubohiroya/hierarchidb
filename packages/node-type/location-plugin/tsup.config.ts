import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: [
    'src/index.ts',
    'src/worker/index.ts',
    'src/ui/index.ts',
  ],
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/runtime-worker-bootstrap',
    '@hierarchidb/download',
    '@hierarchidb/batch',
    'dexie',
  ],
});
