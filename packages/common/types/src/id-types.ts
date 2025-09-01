/**
 * Branded type definitions for IDs to ensure type safety
 */

// Base branded type for Node IDs
export type NodeId = string & { readonly __brand: 'NodeId' };

// Entity IDs
export type EntityId = string & { readonly __brand: 'EntityId' };

// TreeTypes IDs
export type TreeId = string & { readonly __brand: 'TreeId' };

// Working Copy ID is the same as NodeId (uses the same ID as original)
export type WorkingCopyId = NodeId;

/**
 * Type identifier for tree nodes (e.g., 'folder-plugin', 'document', 'styler-plugin', etc.)
 */
export type NodeType = string & { readonly __brand: 'NodeType' };
