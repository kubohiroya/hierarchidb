import type { TabularDataResult, TabularFilterRule, TabularSelectionConfig } from '@hierarchidb/ui-tabular';
import type { TabularDataApi } from '@hierarchidb/ui-tabular';

export async function extractTabularRows(
  api: TabularDataApi,
  tableId: string,
  filters: TabularFilterRule[],
  selection?: TabularSelectionConfig,
  sample = 200
): Promise<TabularDataResult> {
  const hasSelection = selection && selection.valueColumns?.length;
  if (hasSelection) {
    return api.getFilteredData(tableId, selection!);
  }
  return api.getFilteredPreview(tableId, filters, sample);
}
