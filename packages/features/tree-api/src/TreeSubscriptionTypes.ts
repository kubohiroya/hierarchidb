import type { NodeType } from '@hierarchidb/core-types';

export type SubscriptionId = string & { readonly __brand: 'SubscriptionId' };

export type SubscriptionPrefetchOptions = {
  depth: number;
};

export interface SubscriptionOptions {
  includeMetadata?: boolean;
  prefetch?: SubscriptionPrefetchOptions;
  excludeTypes?: NodeType[];
  depth?: number;
  maxDepth?: number;
  minDepth?: number;
}
