import type { TabularDataApi } from '@hierarchidb/ui-tabular-extract';
import { SpreadsheetTabularApiDriver } from '@hierarchidb/spreadsheet-plugin';
import { ShapeTabularMetadataManager } from './ShapeTabularMetadataManager.js';
import { SHAPE_PLUGIN_ID } from '../../common/shared/constants.js';

/**
 * Reuse the shared Spreadsheet CSV driver with a Shape-specific metadata store.
 */
export function createShapeTabularApi(): TabularDataApi {
  const metadataManager = new ShapeTabularMetadataManager();
  return new SpreadsheetTabularApiDriver(metadataManager, SHAPE_PLUGIN_ID);
}
