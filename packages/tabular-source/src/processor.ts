import type { TabularRow, TabularSchema } from './types.js';

export interface TabularContext {
  holderId?: string;
  filename?: string;
  userOptions?: unknown;
}

export interface TabularProcessor {
  id: string;
  // Accept and return a proper TabularSchema (uses ColumnType).
  mapSchema?: (schema: TabularSchema, ctx: TabularContext) => TabularSchema;
  transformRow?: (
    row: TabularRow,
    ctx: TabularContext
  ) => TabularRow | null | Promise<TabularRow | null>;
  validateRow?: (row: TabularRow, ctx: TabularContext) => string[] | Promise<string[]>; // returns errors
}

const registry: TabularProcessor[] = [];

export function registerProcessor(p: TabularProcessor): void {
  if (!registry.find((x) => x.id === p.id)) registry.push(p);
}

export function listProcessors(): ReadonlyArray<TabularProcessor> {
  return registry;
}
