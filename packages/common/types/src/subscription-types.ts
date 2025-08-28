import { TreeNodeEvent } from './tree-node-event-types';

// サブスクリプション関連の型定義
export type SubscriptionId = string & { readonly __brand: 'SubscriptionId' };

export interface SubscriptionOptions {
  includeMetadata?: boolean;
  depth?: number; // Exact depth to match
  maxDepth?: number; // Maximum depth (inclusive)
  minDepth?: number; // Minimum depth (inclusive)
  excludeTypes?: string[];
  filter?: (event: TreeNodeEvent) => boolean;
}
