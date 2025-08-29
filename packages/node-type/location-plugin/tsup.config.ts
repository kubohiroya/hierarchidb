import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@hierarchidb/common-type',
    '@hierarchidb/runtime-batch-processor',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-dialog',
    '@hierarchidb/worker',
  ],
});