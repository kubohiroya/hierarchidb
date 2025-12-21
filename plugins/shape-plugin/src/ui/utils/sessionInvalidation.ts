import type { ProcessingConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../common/types/index.js';
import { getEphemeralShapeDB, type EphemeralStage } from '../../services/database/EphemeralShapeDB.js';

const STAGE_ORDER: EphemeralStage[] = ['download', 'simplify1', 'simplify2', 'vectorTiles'];

type SimpleRecord = object;

const hasDiff = (left: SimpleRecord, right: SimpleRecord): boolean => {
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (!Object.is(leftRecord[key], rightRecord[key])) {
      return true;
    }
  }
  return false;
};

const uniqueStages = (stages: EphemeralStage[]): EphemeralStage[] => {
  const set = new Set<EphemeralStage>();
  for (const stage of stages) set.add(stage);
  return STAGE_ORDER.filter((stage) => set.has(stage));
};

export const resolveShapeSessionId = (draft?: Partial<ShapeEntity> | null): string | undefined =>
  draft?.nodeId ?? draft?.batchSessionId;

export async function clearStagesIfPresent(sessionId: string, stages: EphemeralStage[]): Promise<EphemeralStage[]> {
  const db = getEphemeralShapeDB();
  const targetStages = uniqueStages(stages);
  const cleared: EphemeralStage[] = [];
  for (const stage of targetStages) {
    if (await db.hasStageData(sessionId, stage)) {
      await db.clearStage(sessionId, stage);
      cleared.push(stage);
    }
  }
  return cleared;
}

export function resolveProcessingConfigInvalidation(
  prevConfig: ProcessingConfig | undefined,
  nextConfig: ProcessingConfig | undefined,
): EphemeralStage[] {
  const prev = mergeProcessingConfig(prevConfig ?? DEFAULT_PROCESSING_CONFIG);
  const next = mergeProcessingConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);

  const stages = new Set<EphemeralStage>();

  if (hasDiff(prev.downloadConfig ?? {}, next.downloadConfig ?? {})) {
    stages.add('download');
    stages.add('simplify1');
    stages.add('simplify2');
    stages.add('vectorTiles');
  }

  if (hasDiff(prev.simplificationConfig ?? {}, next.simplificationConfig ?? {})) {
    stages.add('simplify1');
    stages.add('simplify2');
    stages.add('vectorTiles');
  }

  if (hasDiff(prev.tileConfig ?? {}, next.tileConfig ?? {})) {
    stages.add('vectorTiles');
  }

  return uniqueStages(Array.from(stages));
}

export const FULL_INVALIDATION_STAGES: EphemeralStage[] = [
  'download',
  'simplify1',
  'simplify2',
  'vectorTiles',
];
