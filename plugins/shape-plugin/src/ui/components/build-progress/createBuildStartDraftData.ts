import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { sanitizeShapeDraftData } from '../../utils/sanitizeShapeDraftData.ts';

type RecordShape = Record<string, unknown>;

const toRecord = (value: unknown): RecordShape => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordShape)
    : {}
);

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
  const nextSelectedArrayByCountries = (
    patch?.selectedArrayByCountries
    ?? liveData?.selectedArrayByCountries
    ?? currentDraftData.selectedArrayByCountries
  );

  const nextDraftData: RecordShape = {
    ...sanitizeShapeDraftData(currentDraftData),
    ...sanitizeShapeDraftData(patch ?? {}),
    buildConfig: nextBuildConfig,
  };
  if (nextSelectedArrayByCountries !== undefined) {
    nextDraftData.selectedArrayByCountries = nextSelectedArrayByCountries;
  }
  return nextDraftData;
};
