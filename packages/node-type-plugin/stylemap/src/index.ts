// Types
export type {
  StyleMapEntity,
  StyleMapColorRule,
  StyleMapStyle,
} from './entities/StyleMapEntity';

// Components
export { StyleMapSimpleDialog } from './components/StyleMapSimpleDialog';
export type { StyleMapSimpleDialogProps, StyleMapCreateConfig } from './components/StyleMapSimpleDialog';

// Handlers
export { StyleMapEntityHandler } from './handlers/StyleMapEntityHandler';

// Note: These types would normally be imported from plugin-spreadsheet
export type SpreadsheetRow = Record<string, unknown>;
export type SpreadsheetImportOptions = {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
};