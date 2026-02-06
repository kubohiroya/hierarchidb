import type { StyleDescriptor, StyleKeyValues } from './styleTypes.js';
import type { NodeId } from '@hierarchidb/core-types';

export interface StyleQueryAPI {
  getStyleDescriptor(nodeId: NodeId): Promise<StyleDescriptor | null>;
  getStyleKeyValues(nodeId: NodeId): Promise<StyleKeyValues | null>;
}
