import type { NodeType } from '@hierarchidb/core-types';

export function normalizeNodeType(input: string | undefined | null): NodeType | undefined {
  if (!input) return undefined;
  const raw = String(input);
  const base = raw.split('::')[0] ?? '';
  if (!base) return undefined;
  const normalized = base.endsWith('-plugin') ? base.slice(0, -7) : base;
  return normalized ? (normalized as NodeType) : undefined;
}
