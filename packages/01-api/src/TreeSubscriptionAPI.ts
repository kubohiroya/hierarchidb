/**
 * @file TreeSubscriptionAPI.ts
 * @description Real-time data monitoring and subscription-based tree management API
 * 
 * This API provides subscription-based monitoring capabilities for tree nodes and subtrees.
 * It handles real-time updates through event-driven notifications and manages subscription lifecycles.
 */

import type { 
  NodeId, 
  TreeId, 
  TreeNodeEvent, 
  SubscriptionId,
  SubscriptionOptions 
} from '@hierarchidb/00-core';

/**
 * Real-time data subscription and monitoring API
 * 
 * Provides event-driven monitoring of tree nodes and subtrees with automatic
 * cleanup and lifecycle management.
 */
export interface TreeSubscriptionAPI {

  // ==================
  // Node Subscriptions
  // ==================

  /**
   * Subscribe to changes for a specific node
   * 
   * @param nodeId - Target node identifier
   * @param callback - Function to call when node changes occur
   * @param options - Optional subscription configuration
   * @returns Subscription identifier for cleanup
   * 
   * @example
   * ```typescript
   * const subscriptionId = await observableAPI.subscribeNode(
   *   nodeId,
   *   (event) => {
   *     console.log(`Node ${event.nodeId} was ${event.type}`);
   *   },
   *   { includeMetadata: true }
   * );
   * ```
   */
  subscribeNode(
    nodeId: NodeId,
    callback: (event: TreeNodeEvent) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionId>;

  /**
   * Subscribe to changes for an entire subtree
   * 
   * @param rootNodeId - Root node of the subtree to monitor
   * @param callback - Function to call when any node in subtree changes
   * @param options - Optional subscription configuration
   * @returns Subscription identifier for cleanup
   * 
   * @example
   * ```typescript
   * const subscriptionId = await observableAPI.subscribeSubtree(
   *   rootNodeId,
   *   (event) => {
   *     console.log(`Subtree change: ${event.type} on ${event.nodeId}`);
   *   },
   *   { depth: 3, excludeTypes: ['temp'] }
   * );
   * ```
   */
  subscribeSubtree(
    rootNodeId: NodeId,
    callback: (event: TreeNodeEvent) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionId>;

  /**
   * Subscribe to all changes within a specific tree
   * 
   * @param treeId - Target tree identifier
   * @param callback - Function to call when any node in tree changes
   * @param options - Optional subscription configuration
   * @returns Subscription identifier for cleanup
   */
  subscribeTree(
    treeId: TreeId,
    callback: (event: TreeNodeEvent) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionId>;

  // ==================
  // Subscription Management
  // ==================

  /**
   * Remove a specific subscription
   * 
   * @param subscriptionId - Identifier of subscription to remove
   * @returns Promise that resolves when subscription is cleaned up
   * 
   * @example
   * ```typescript
   * await subscriptionAPI.unsubscribe(subscriptionId);
   * console.log('Subscription removed');
   * ```
   */
  unsubscribe(subscriptionId: SubscriptionId): Promise<void>;

  /**
   * Remove all subscriptions for a specific node
   * 
   * @param nodeId - Target node identifier
   * @returns Number of subscriptions that were removed
   */
  unsubscribeNode(nodeId: NodeId): Promise<number>;

  /**
   * Remove all subscriptions for a specific tree
   * 
   * @param treeId - Target tree identifier
   * @returns Number of subscriptions that were removed
   */
  unsubscribeTree(treeId: TreeId): Promise<number>;

  /**
   * Remove all active subscriptions
   * 
   * @returns Total number of subscriptions that were removed
   */
  unsubscribeAll(): Promise<number>;

  // ==================
  // Subscription Status
  // ==================

  /**
   * Get list of active subscription identifiers
   * 
   * @returns Array of currently active subscription IDs
   */
  listActiveSubscriptions(): Promise<SubscriptionId[]>;

  /**
   * Check if a specific subscription is still active
   * 
   * @param subscriptionId - Subscription identifier to check
   * @returns True if subscription exists and is active
   */
  isSubscriptionActive(subscriptionId: SubscriptionId): Promise<boolean>;

  /**
   * Get subscription statistics
   * 
   * @returns Object containing subscription counts and performance metrics
   */
  getSubscriptionStats(): Promise<{
    totalActive: number;
    nodeSubscriptions: number;
    subtreeSubscriptions: number;
    treeSubscriptions: number;
    eventsProcessedToday: number;
    averageEventLatency: number;
  }>;

  // ==================
  // Event History
  // ==================

  /**
   * Get recent events for a specific node
   * 
   * @param nodeId - Target node identifier
   * @param limit - Maximum number of events to return (default: 50)
   * @returns Array of recent events in chronological order
   */
  getRecentEvents(nodeId: NodeId, limit?: number): Promise<TreeNodeEvent[]>;

  /**
   * Get event history for a time range
   * 
   * @param startTime - Start of time range (Unix timestamp)
   * @param endTime - End of time range (Unix timestamp)
   * @param nodeId - Optional node filter
   * @returns Array of events within the specified time range
   */
  getEventHistory(
    startTime: number,
    endTime: number,
    nodeId?: NodeId
  ): Promise<TreeNodeEvent[]>;
}

/**
 * Default export for the TreeSubscriptionAPI interface
 */
export default TreeSubscriptionAPI;