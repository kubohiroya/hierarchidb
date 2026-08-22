// Backward-compatible facade that now delegates to the generic properties table.
export {
  getColumnWidths,
  removeColumnWidths,
  removeColumnWidthsMany,
  saveColumnWidths,
} from './properties-db.js';
