import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'dexie',
    'maplibre-gl',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/geo-layers',
    '@deck.gl/aggregation-layers',
    '@deck.gl/mesh-layers',
    '@deck.gl/mapbox',
    '@deck.gl/extensions',
    '@turf/turf',
    'd3-scale',
    'h3-js',
    'jspdf'
  ],
  treeshake: true,
  minify: false,
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'react';
  }
});