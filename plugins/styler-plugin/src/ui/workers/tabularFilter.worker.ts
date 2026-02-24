/// <reference lib="webworker" />

import type { TabularFilterRule } from '@hierarchidb/ui-tabular';
import type { StylerTableRow } from '~/common/types/StylerEntity';
import { applyFilters } from '~/ui/utils/tabularFilters';

type FilterRequest = {
  id: number;
  rows: StylerTableRow[];
  filters: TabularFilterRule[];
  limit?: number;
};

type FilterResponse = {
  id: number;
  rows: StylerTableRow[];
  error?: string;
};

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<FilterRequest>) => {
  const { id, rows, filters, limit = 1000 } = event.data ?? {};
  try {
    const filtered = applyFilters(rows ?? [], filters ?? [], limit);
    const response: FilterResponse = { id, rows: filtered };
    ctx.postMessage(response);
  } catch (error) {
    const response: FilterResponse = {
      id,
      rows: [],
      error: error instanceof Error ? error.message : String(error),
    };
    ctx.postMessage(response);
  }
};
