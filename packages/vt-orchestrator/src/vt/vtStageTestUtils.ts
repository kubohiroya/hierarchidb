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
  buildAdminFeatureSummary,
  buildVtParentInputSummary,
} from './vtStageSummary.js';

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
