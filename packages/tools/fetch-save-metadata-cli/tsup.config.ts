import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: false,
  target: 'node18',
  external: ['@hierarchidb/runtime-shared-fetch-save-metadata', 'commander'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
