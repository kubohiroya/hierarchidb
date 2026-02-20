export {
  SPREADSHEET_PLUGIN_ID,
  SPREADSHEET_PLUGIN_VERSION,
  SPREADSHEET_NODE_TYPE,
} from '~/plugin-manifest';

export const DATA_SOURCE_TYPES = {
  FILE: 'file',
  URL: 'url',
} as const;

export const STEP_LABELS = {
  dataSource: 'Data Source',
  filtering: 'Filtering',
} as const;
