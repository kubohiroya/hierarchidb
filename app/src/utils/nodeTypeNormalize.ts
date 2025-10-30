import type { NodeType } from '@hierarchidb/feature-core/common-types';

export function normalizeNodeType(input: string | undefined | null): NodeType | undefined {
  if (!input) return undefined;
  const s = String(input);
  return (s.endsWith('-plugin') ? s.slice(0, -7) : s) as NodeType;
}

