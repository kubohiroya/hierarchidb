import { isSkippedMessage } from './taskStatus.js';

export type StageTaskRecord = {
  status?: string;
  message?: string | null;
};

export type StageSummary = {
  total: number;
  completed: number;
  skipped: number;
  failed: number;
};

/**
 * ステージレコードの配列から、UI/ログ用のサマリを作ります。
 */
export function summarizeStageRecords(records: StageTaskRecord[]): StageSummary {
  const total = records.length;
  const skipped = records.filter((task) => isSkippedMessage(task.message)).length;
  const failed = records.filter((task) => task.status === 'failed' || task.status === 'regression').length;
  const completed = Math.max(0, records.filter((task) => task.status === 'completed').length - skipped);
  return { total, completed, skipped, failed };
}

