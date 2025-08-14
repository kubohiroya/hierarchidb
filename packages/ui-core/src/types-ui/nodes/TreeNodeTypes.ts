/**
 * Core node types used throughout the application
 * These represent the fundamental entity types in the system
 */
export const TreeNodeTypes = {
  // Root node types
  ProjectsRoot: 0,
  ResourcesRoot: 2,
  ProjectsTrashRoot: 4,
  ResourcesTrashRoot: 6,

  // Container types
  ProjectFolder: 10,
  // Project types
  Project: 12,

  ResourceFolder: 100,

  BaseMap: 102,

  // Resource types
  Shapes: 104,

  // New resource types for geographic features
  Locations: 106,

  Routes: 108,

  StyleMap: 110,

  // Property resolver for linking geographic properties with data sources
  PropertyResolver: 112,
} as const;

// Type definition for TreeNodeType values
export type NodeType = typeof TreeNodeTypes;

// Type guard to check if a value is a valid TreeNodeType
export function isNodeType(value: NodeType): value is NodeType {
  return typeof value === 'number' && Object.values(TreeNodeTypes).includes(value);
}
