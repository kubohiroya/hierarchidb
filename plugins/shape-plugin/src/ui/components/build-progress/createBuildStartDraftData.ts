import type { ShapeEntity } from '~/common/types/ShapeEntity';
import { sanitizeShapeDraftData } from '~/ui/utils/sanitizeShapeDraftData';

type RecordShape = Record<string, unknown>;

const toRecord = (value: unknown): RecordShape =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordShape) : {};

export const createBuildStartDraftData = (params: {
  currentDraftData: RecordShape;
  liveData?: Partial<ShapeEntity>;
  patch?: Partial<ShapeEntity>;
}): RecordShape => {
  const { currentDraftData, liveData, patch } = params;
  const persistedBuildConfig = toRecord(currentDraftData.buildConfig);
  const nextBuildConfig = {
    ...persistedBuildConfig,
    ...toRecord(liveData?.buildConfig),
    ...toRecord(patch?.buildConfig),
  };
  const persistedProcessingConfig = toRecord(currentDraftData.processingConfig);
  const nextProcessingConfig = {
    ...persistedProcessingConfig,
    ...toRecord(liveData?.processingConfig),
    ...toRecord(patch?.processingConfig),
  };
  const nextSelectedArrayByCountries =
    patch?.selectedArrayByCountries ??
    liveData?.selectedArrayByCountries ??
    currentDraftData.selectedArrayByCountries;

  const nextDraftData: RecordShape = {
    ...sanitizeShapeDraftData(currentDraftData),
    ...sanitizeShapeDraftData(patch ?? {}),
    buildConfig: nextBuildConfig,
    processingConfig: nextProcessingConfig,
  };
  if (nextSelectedArrayByCountries !== undefined) {
    nextDraftData.selectedArrayByCountries = nextSelectedArrayByCountries;
  }
  return nextDraftData;
};
