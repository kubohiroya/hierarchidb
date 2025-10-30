export function resolveDefaultNodeName(nodeType: string): string {
  if (!nodeType) return 'New Node';
  const normalized = nodeType.trim();
  if (!normalized) return 'New Node';
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return `New ${capitalized}`;
}

export class WorkerAPIImpl {
  async initialize(): Promise<void> {}
}
