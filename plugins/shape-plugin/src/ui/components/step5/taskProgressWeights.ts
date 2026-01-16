type TaskWeightMetadata = {
  polygonCount?: number;
  weight?: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

const coerceWeight = (value: number): number => Math.max(0, Math.round(value));

export const resolveTaskWeight = (task: unknown): number => {
  const taskRecord = asRecord(task);
  const metadata = asRecord(taskRecord?.metadata) as TaskWeightMetadata | null;
  const weight = readNumber(metadata?.weight) ?? readNumber(metadata?.polygonCount);
  if (weight === null) return 1;
  return coerceWeight(weight);
};
