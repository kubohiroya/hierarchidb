import type { TabularSchema } from './types';

export interface TabularContext {
  holderId?: string;
  filename?: string;
  userOptions?: Record<string, any>;
}

export interface TabularProcessor {
  id: string;
  // Accept and return a proper TabularSchema (uses ColumnType).
  mapSchema?: (schema: TabularSchema, ctx: TabularContext) => TabularSchema;
  transformRow?: (row: Record<string, any>, ctx: TabularContext) => Record<string, any> | null | Promise<Record<string, any> | null>;
  validateRow?: (row: Record<string, any>, ctx: TabularContext) => string[] | Promise<string[]>; // returns errors
}

const registry: TabularProcessor[] = [];

export function registerProcessor(p: TabularProcessor): void {
  if (!registry.find((x) => x.id === p.id)) registry.push(p);
}

export function listProcessors(): ReadonlyArray<TabularProcessor> {
  return registry;
}
