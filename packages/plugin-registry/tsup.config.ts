import { createTsupConfig } from '../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts'
  },
  external: [
    '@hierarchidb/basemap-plugin/ui',
    '@hierarchidb/folder-plugin/ui',
    '@hierarchidb/location-plugin/ui',
    '@hierarchidb/route-plugin/ui',
    '@hierarchidb/shape-plugin/ui',
    '@hierarchidb/spreadsheet-plugin/ui',
    '@hierarchidb/styler-plugin/ui',
    '@hierarchidb/timeline-plugin/ui',
    '@hierarchidb/basemap-plugin/worker',
    '@hierarchidb/folder-plugin/worker',
    '@hierarchidb/location-plugin/worker',
    '@hierarchidb/route-plugin/worker',
    '@hierarchidb/shape-plugin/worker',
    '@hierarchidb/spreadsheet-plugin/worker',
    '@hierarchidb/styler-plugin/worker',
    '@hierarchidb/timeline-plugin/worker'
  ]
});
