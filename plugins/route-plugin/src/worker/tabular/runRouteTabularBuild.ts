import type { NodeId } from '@hierarchidb/core-types';
import type { TabularDataApi, TabularFilterRule, TabularSelectionConfig } from '@hierarchidb/ui-tabular';
import type { ProgressReporter } from './progressTypes.js';
import { extractTabularRows } from './extractTabularRows.js';
import { materializeRouteSegmentsFromTabular } from './materializeRouteSegmentsFromTabular.js';

export async function runRouteTabularBuild(
  api: TabularDataApi,
  tableId: string,
  filters: TabularFilterRule[],
  selection: TabularSelectionConfig | undefined,
  nodeId: NodeId,
  reportProgress?: ProgressReporter
): Promise<void> {
  if (reportProgress) reportProgress({ stage: 'extract', completed: 0, total: 1, updatedAt: Date.now() });
  const rows = await extractTabularRows(api, tableId, filters, selection);
  if (reportProgress) reportProgress({ stage: 'extract', completed: 1, total: 1, updatedAt: Date.now() });
  await materializeRouteSegmentsFromTabular(nodeId, rows, reportProgress);
}
