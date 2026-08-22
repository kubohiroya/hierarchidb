import {
  buildTileKey,
  resolveVtDebugFocusConfig,
  resolveVtDebugFocusMatch,
} from './vtStageDebug.js';
import {
  buildAdminFeatureSummary,
  buildGeojsonVtEmptyTileReason,
  buildGeojsonVtEmptyTileSummaryReason,
  buildSkippedMessage,
  buildTileSummary,
  buildVtParentInputSummary,
  computeOutputTileTotals,
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
