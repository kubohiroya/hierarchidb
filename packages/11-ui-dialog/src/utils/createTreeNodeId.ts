/**
 * @file createNodeId.ts
 * @description Utility to create NodeId type
 */

// Temporary type definitions until @hierarchidb/core is available
export type NodeId = string;

/**
 * Create a NodeId from a string
 */
export const createNodeId = (id: string): NodeId => {
  return id as NodeId;
};