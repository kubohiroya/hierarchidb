import type { NodeId } from '@hierarchidb/core-types';
import type { TabularDataApi, TabularFilterRule, TabularSelectionConfig } from '@hierarchidb/ui-tabular';
import { extractTabularRows } from './extractTabularRows.js';
import { materializeLocationPointsFromTabular } from './materializeLocationPointsFromTabular.js';

type ProgressReporter = (progress: {
  stage?: string;
  completed?: number;
  total?: number;
  updatedAt?: number;
}) => void;

export async function runLocationTabularBuild(
  api: TabularDataApi,
  tableId: string,
  filters: TabularFilterRule[],
  selection: TabularSelectionConfig | undefined,
  nodeId: NodeId,
  reportProgress?: ProgressReporter
): Promise<void> {
  if (reportProgress) {
    reportProgress({ stage: 'extract', completed: 0, total: 1, updatedAt: Date.now() });
  }
  const rows = await extractTabularRows(api, tableId, filters, selection);
  if (reportProgress) {
    reportProgress({ stage: 'extract', completed: 1, total: 1, updatedAt: Date.now() });
  }
  await materializeLocationPointsFromTabular(nodeId, rows, reportProgress);
}
