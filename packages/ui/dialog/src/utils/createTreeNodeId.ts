/**
 * @file createNodeId.ts
 * @description Utility to create NodeId type
 */

import { NodeId } from '@hierarchidb/common-core';

/**
 * Create a NodeId from a string
 */
export const createNodeId = (id: string): NodeId => {
  return id as NodeId;
};