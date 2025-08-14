export type TreeNodeId = string;

// Type guard to check if a value is a TreeNodeId
export function isTreeNodeId(value: unknown): value is TreeNodeId {
  return typeof value === 'string';
}

// Create a TreeNodeId from a string
export function createTreeNodeId(value: string): TreeNodeId {
  return value as TreeNodeId;
}

// Get the string value from a TreeNodeId
export function getTreeNodeIdValue(id: TreeNodeId): string {
  return id;
}
