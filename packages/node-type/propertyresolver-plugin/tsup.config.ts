import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'comlink',
    'dexie'
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});