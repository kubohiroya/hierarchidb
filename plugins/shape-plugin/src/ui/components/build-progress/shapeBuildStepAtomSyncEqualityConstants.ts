export const shallowEqualRecord = <T extends Record<string, unknown> | null | undefined>(
  a: T,
  b: T
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]
  );
};

const shallowEqualNumberRecord = (
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

type StageTotals = Record<
  string,
  {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  }
>;

const shallowEqualStageTotals = (
  a: StageTotals | null | undefined,
  b: StageTotals | null | undefined
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => {
    const left = a[key];
    const right = b[key];
    if (!left || !right) return false;
    return (
      left.total === right.total &&
      left.completed === right.completed &&
      left.failed === right.failed &&
      left.skipped === right.skipped
    );
  });
};

type TaskProgressSummaryLike = {
  stageLabel: string;
  taskLabel: string;
  taskUnitLabel: string;
  overallProgress: number;
  completed: number;
  total: number;
  failed: number;
  skipped: number;
  buildStatus: string;
  hasProgressData: boolean;
  timingStageId?: string | null;
  completedStageElapsedMs: Record<string, number>;
  totalElapsedMs: number;
  stageElapsedMs: number;
  stageRemainingMs: number | null;
  stageTotals: StageTotals;
};

export const shallowEqualTaskProgressSummary = (
  a: TaskProgressSummaryLike | null | undefined,
  b: TaskProgressSummaryLike | null | undefined
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.stageLabel === b.stageLabel &&
    a.taskLabel === b.taskLabel &&
    a.taskUnitLabel === b.taskUnitLabel &&
    a.overallProgress === b.overallProgress &&
    a.completed === b.completed &&
    a.total === b.total &&
    a.failed === b.failed &&
    a.skipped === b.skipped &&
    a.buildStatus === b.buildStatus &&
    a.hasProgressData === b.hasProgressData &&
    a.timingStageId === b.timingStageId &&
    a.totalElapsedMs === b.totalElapsedMs &&
    a.stageElapsedMs === b.stageElapsedMs &&
    a.stageRemainingMs === b.stageRemainingMs &&
    shallowEqualNumberRecord(a.completedStageElapsedMs, b.completedStageElapsedMs) &&
    shallowEqualStageTotals(a.stageTotals, b.stageTotals)
  );
};
