export {
  SPREADSHEET_NODE_TYPE,
  SPREADSHEET_PLUGIN_ID,
  SPREADSHEET_PLUGIN_VERSION,
} from '../plugin-manifest.js';

export const DATA_SOURCE_TYPES = {
  FILE: 'file',
  URL: 'url',
} as const;

export const STEP_LABELS = {
  dataSource: 'Data Source',
  filtering: 'Filtering',
} as const;
