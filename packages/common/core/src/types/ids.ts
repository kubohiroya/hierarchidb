/**
 * Branded type definitions for IDs to ensure type safety
 */

// Base branded type for Node IDs
export type NodeId = string & { readonly __brand: 'NodeId' };

// Entity IDs
export type EntityId = string & { readonly __brand: 'EntityId' };

// Tree IDs
export type TreeId = string & { readonly __brand: 'TreeId' };

// Working Copy ID is the same as NodeId (uses the same ID as original)
export type WorkingCopyId = NodeId;

// Helper functions to create branded types
export const toNodeId = (id: string): NodeId => id as NodeId;
export const toEntityId = (id: string): EntityId => id as EntityId;
export const toTreeId = (id: string): TreeId => id as TreeId;

// Type guards
export const isNodeId = (id: unknown): id is NodeId => {
  return typeof id === 'string';
};

export const isEntityId = (id: unknown): id is EntityId => {
  return typeof id === 'string';
};

export const isTreeId = (id: unknown): id is TreeId => {
  return typeof id === 'string';
};

// Utility function to generate new IDs
export const generateNodeId = (): NodeId => {
  return toNodeId(crypto.randomUUID());
};

export const generateEntityId = (): EntityId => {
  return toEntityId(crypto.randomUUID());
};

export const generateTreeId = (): TreeId => {
  return toTreeId(crypto.randomUUID());
};

// No legacy aliases - clean break