// Keep this module self-contained to simplify build; use string for NodeType here
type NodeType = string;

const tabularSet = new Set<NodeType>();

export function registerTabularSource(nodeType: NodeType): void {
  tabularSet.add(nodeType);
}

export function unregisterTabularSource(nodeType: NodeType): void {
  tabularSet.delete(nodeType);
}

export function isTabularSource(nodeType: NodeType): boolean {
  return tabularSet.has(nodeType);
}

export function listTabularSources(): NodeType[] {
  return Array.from(tabularSet.values());
}
