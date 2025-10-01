import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTsupConfig } from '../../../tsup.base.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTERNAL_MODULES = [
  '@hierarchidb/runtime-worker',
  '@hierarchidb/runtime-worker-bootstrap',
  '@hierarchidb/map-adapter',
  '@hierarchidb/tabular-xlsx',
  '@hierarchidb/plugins-basemap-plugin/worker-factory',
  '@hierarchidb/plugins-folder-plugin/worker-factory',
  '@hierarchidb/plugins-resolver-plugin/worker-factory',
  '@hierarchidb/plugins-route-plugin/worker-factory',
  '@hierarchidb/plugins-spreadsheet-plugin/worker-factory',
  '@hierarchidb/plugins-styler-plugin/worker-factory',
  '@hierarchidb/plugins-shape-plugin/worker-factory',
  '@hierarchidb/plugins-location-plugin/worker-factory',
  '@hierarchidb/plugins-linker-plugin/worker-factory',
  '@hierarchidb/plugins-timeline-plugin/worker-factory',
];

const config = createTsupConfig({
  external: EXTERNAL_MODULES,
});

config.onSuccess = () => {
  const src = path.resolve(__dirname, 'src/external-modules.d.ts');
  const dest = path.resolve(__dirname, 'dist/external-modules.d.ts');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
};

export default config;
