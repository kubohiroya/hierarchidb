import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/aggregation-layers',
    '@deck.gl/geo-layers',
    '@deck.gl/mesh-layers',
    '@deck.gl/extensions',
    '@deck.gl/mapbox',
    'dexie',
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client"',
    };
  },
});
