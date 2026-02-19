import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type { ShapeEntity } from '../../../../../common/types/index.js';
import { toProcessingStatus } from './status.ts';

export const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

export const toTransitionErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  const message = getErrorMessage(error);
  if (error === null || error === undefined) {
    return fallback;
  }
  if (message === 'undefined' || message === '[object Object]') {
    return fallback;
  }
  return message;
};

export const summarizeSelectedEntries = (
  selectedArrayByCountries: ShapeEntity['selectedArrayByCountries'] | null | undefined,
): { selectedCountryCount: number; selectedAdminPairCount: number } => {
  if (!selectedArrayByCountries || typeof selectedArrayByCountries !== 'object' || Array.isArray(selectedArrayByCountries)) {
    return { selectedCountryCount: 0, selectedAdminPairCount: 0 };
  }
  let selectedCountryCount = 0;
  let selectedAdminPairCount = 0;
  Object.values(selectedArrayByCountries).forEach((row) => {
    if (!Array.isArray(row)) return;
    let hasSelectedInCountry = false;
    row.forEach((selected) => {
      if (selected) {
        hasSelectedInCountry = true;
        selectedAdminPairCount += 1;
      }
    });
    if (hasSelectedInCountry) {
      selectedCountryCount += 1;
    }
  });
  return { selectedCountryCount, selectedAdminPairCount };
};

export const resolveBuildSessionRecordForPersistence = (sessionRecord: ShapeBuildSessionRecord | null) => ({
  persistedProcessingStatus: sessionRecord ? toProcessingStatus(sessionRecord.status) : null,
  persistedStageElapsedStageId: typeof sessionRecord?.stageId === 'string' ? sessionRecord.stageId : null,
  persistedStageElapsedByStage: sessionRecord?.elapsedByStage ?? {},
});
