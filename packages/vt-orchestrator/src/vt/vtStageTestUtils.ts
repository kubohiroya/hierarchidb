import {
  buildTileKey,
  resolveVtDebugFocusConfig,
  resolveVtDebugFocusMatch,
} from './vtStageDebug.js';
import {
  buildGeojsonVtEmptyTileReason,
  buildGeojsonVtEmptyTileSummaryReason,
  buildSkippedMessage,
  buildTileSummary,
  computeOutputTileTotals,
} from './vtStageSummary.js';
import { buildAdminFeatureSummary, buildVtParentInputSummary } from './vtStageCore.js';

export const vtStageTestUtils = {
  buildAdminFeatureSummary,
  buildTileSummary,
  buildTileKey,
  buildSkippedMessage,
  buildVtParentInputSummary,
  buildGeojsonVtEmptyTileReason,
  buildGeojsonVtEmptyTileSummaryReason,
  resolveVtDebugFocusConfig,
  resolveVtDebugFocusMatch,
  computeOutputTileTotals,
};
