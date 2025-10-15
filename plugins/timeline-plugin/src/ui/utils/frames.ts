export type TreeNode = { id: string; name?: string };

export type TimelineFrame = { id: string; name: string };

export function toFramesFromNodes(nodes: readonly TreeNode[]): TimelineFrame[] {
  return nodes
    .map((n) => ({ id: String(n.id), name: String(n.name || '') }))
    .filter((f) => !!f.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}
