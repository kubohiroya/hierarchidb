/**
 * Branded type definitions for IDs to ensure type safety
 */

// Base branded type for Node IDs
export type NodeId = string & { readonly __brand: 'NodeId' };

// TreeTypes IDs
export type TreeId = string & { readonly __brand: 'TreeId' };

// Working Copy ID is the same as NodeId (uses the same ID as original)
export type DraftId = NodeId;

/**
 * Type identifier for console nodes (e.g., 'folder-plugin', 'document', 'styler-plugin', etc.)
 */
export type NodeType = string & { readonly __brand: 'NodeType' };

// Optional branded ID used by some plugin-loader for entity records (alias of NodeId)
export type EntityId = NodeId;

// Branded ID for console nodes when explicitly distinguished from NodeId in some modules
export type TreeNodeId = string & { readonly __brand: 'TreeNodeId' };
