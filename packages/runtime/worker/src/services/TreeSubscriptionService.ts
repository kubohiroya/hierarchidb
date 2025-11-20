import type { TreeQueryAPI } from '@hierarchidb/common-api';
import type {
  CommandEnvelope,
  NodeId,
  ObserveNodePayload,
  ObserveSubtreePayload,
  ObserveWorkingCopiesPayload,
  SubscribeChildrenPayload,
  SubscriptionFilter,
  SubscriptionId,
  SubscriptionOptions,
  Timestamp,
  TreeChangeEvent,
  TreeId,
  TreeNode,
  TreeNodeEvent,
  UndoStateEvent,
} from '@hierarchidb/common-types';
import { SingletonMixin } from '@hierarchidb/util';
import {
  bufferTime,
  concat,
  from,
  map,
  mergeMap,
  type Observable,
  filter as rxFilter,
  Subject,
  share,
} from 'rxjs';
import type { CoreDB } from './CoreDB.js';
import { FulltextIndexService } from './FulltextIndexService.js';
import { type SubscriptionInfo, SubscriptionRegistry } from './SubscriptionRegistry.js';
import { TreeQueryService } from './TreeQueryService.js';
import { TreeSearchService } from './TreeSearchService.js';

/**
 * TreeSubscriptionService - Implements TreeSubscriptionAPI
 * Provides real-time subscription functionality for console structure changes
 */
export class TreeSubscriptionService {
  static async getSingleton(
    coreDB: CoreDB,
    treeQuery?: TreeQueryAPI
  ): Promise<TreeSubscriptionService> {
    return SingletonMixin.getSingleton(TreeSubscriptionService.name, async () => {
      const resolvedQuery =
        treeQuery ||
        (await TreeQueryService.getSingleton(
          coreDB,
          await FulltextIndexService.getSingleton(coreDB)
        ));
      return new TreeSubscriptionService(coreDB, resolvedQuery);
    });
  }

  private readonly registry = new SubscriptionRegistry();
  private globalChangeSubject = new Subject<TreeChangeEvent>();
  private eventHistory: TreeNodeEvent[] = [];
  private readonly maxEventHistory = 1000;
  private eventsProcessedToday = 0;
  private totalLatency = 0;
  private eventCount = 0;

  private readonly undoStateSubscriptions = new Map<
    SubscriptionId,
    (event: UndoStateEvent) => void
  >();
  private latestUndoState: UndoStateEvent = {
    type: 'undo-state',
    canUndo: false,
    canRedo: false,
    timestamp: Date.now() as Timestamp,
  };

  private readonly searchService: TreeSearchService;

  constructor(
    private coreDB: CoreDB,
    treeQuery: TreeQueryAPI
  ) {
    this.searchService = new TreeSearchService(treeQuery);
    //  CoreDBchangeSubject
    this.coreDB.changeSubject.subscribe({
      next: (event) => {
        this.globalChangeSubject.next(event);
      },
    });

    // Set up periodic subscription cleanup
    this.setupPeriodicSubscriptionCleanup();
  }

  subscribeNodeCommand(
    cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload>
  ): Observable<TreeChangeEvent> {
    const { nodeId, includeInitialValue = false } = cmd.payload;

    const subscriptionId = this.generateSubscriptionId();
    const subject = new Subject<TreeChangeEvent>();

    // Store subscription info
    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId as SubscriptionId,
      type: 'node',
      nodeId,
      options: { includeMetadata: includeInitialValue },
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
    this.registry.register(subscriptionInfo);

    // Create observable that filters global changes for this specific node
    const nodeObservable = this.globalChangeSubject.pipe(
      rxFilter((event) => this.isEventRelevantForNodeObservation(event, nodeId)),
      map((event) => this.transformEventForSubscription(event)),
      share()
    );

    // Subscribe to global changes and forward relevant ones
    const subscription = nodeObservable.subscribe({
      next: (event) => {
        subject.next(event);
        this.updateSubscriptionActivity(subscriptionId as SubscriptionId);
      },
    });

    // Handle initial value if requested
    let resultObservable: Observable<TreeChangeEvent> = subject.asObservable();

    if (includeInitialValue) {
      const initial$ = from(this.createInitialNodeEventAsync(nodeId));
      resultObservable = concat(initial$, resultObservable);
    }

    // Clean up subscription when unsubscribed
    /* eslint-disable deprecation/deprecation */
    const originalSubscribe = resultObservable.subscribe.bind(resultObservable);
    const customSubscribe = (
      ...args: Parameters<typeof originalSubscribe>
    ): ReturnType<typeof originalSubscribe> => {
      const sub = originalSubscribe(...args);
      const originalUnsubscribe = sub.unsubscribe.bind(sub);
      sub.unsubscribe = () => {
        subscription.unsubscribe();
        this.deactivateSubscription(subscriptionId as SubscriptionId);
        originalUnsubscribe();
      };
      return sub;
    };
    /* eslint-enable deprecation/deprecation */

    // Override the subscribe method
    Object.defineProperty(resultObservable, 'subscribe', {
      value: customSubscribe,
      writable: false,
      configurable: true,
    });

    return resultObservable;
  }

  subscribeChildrenCommand(
    cmd: CommandEnvelope<'subscribeChildren', SubscribeChildrenPayload>
  ): Observable<TreeChangeEvent> {
    const { parentId, filter, includeInitialSnapshot = false } = cmd.payload;

    const subscriptionId = this.generateSubscriptionId();
    const subject = new Subject<TreeChangeEvent>();

    // Store subscription info
    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      type: 'childNodes',
      nodeId: parentId,
      filter,
      subject,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
    this.registry.register(subscriptionInfo);

    // Create observable that filters global changes for childNodes of this node
    const childNodesObservable = this.globalChangeSubject.pipe(
      rxFilter((event) => this.isEventRelevantForChildNodesObservation(event, parentId, filter)),
      // Progressive batching: coalesce bursts and emit current snapshot in chunks
      bufferTime(30),
      rxFilter((batch) => batch.length > 0),
      mergeMap(async () => {
        let children = await this.coreDB.listChildren(parentId);
        if (filter?.nodeTypes?.length) {
          const allowedTypes = filter.nodeTypes;
          children = children.filter((n) => allowedTypes?.includes(n.nodeType));
        }
        const chunkSize = 200;
        const events: TreeChangeEvent[] = [];
        for (let i = 0; i < children.length; i += chunkSize) {
          const slice = children.slice(i, i + chunkSize);
          events.push({
            type: 'children-changed',
            nodeId: parentId,
            affectedChildren: slice.map((c) => c.id),
            timestamp: Date.now() as Timestamp,
          });
        }
        if (children.length === 0) {
          events.push({
            type: 'children-changed',
            nodeId: parentId,
            affectedChildren: [],
            timestamp: Date.now() as Timestamp,
          });
        }
        return events;
      }),
      mergeMap((events) => from(events)),
      share()
    );

    // Subscribe to global changes and forward relevant ones
    const subscription = childNodesObservable.subscribe({
      next: (event) => {
        subject.next(event);
        this.updateSubscriptionActivity(subscriptionId);
      },
    });

    // Handle initial snapshot if requested
    let resultObservable: Observable<TreeChangeEvent> = subject.asObservable();

    if (includeInitialSnapshot) {
      const initial$ = from(this.createInitialChildNodesEvents(parentId, filter));
      resultObservable = concat(initial$, resultObservable);
    }

    // Set up unsubscribe handler
    /* eslint-disable deprecation/deprecation */
    const originalSubscribe = resultObservable.subscribe.bind(resultObservable);
    resultObservable.subscribe = ((...args: Parameters<typeof originalSubscribe>) => {
      const sub = originalSubscribe(...args);
      const originalUnsubscribe = sub.unsubscribe.bind(sub);
      sub.unsubscribe = () => {
        subscription.unsubscribe();
        this.deactivateSubscription(subscriptionId as SubscriptionId);
        originalUnsubscribe();
      };
      return sub;
    }) as typeof resultObservable.subscribe;
    /* eslint-enable deprecation/deprecation */

    return resultObservable;
  }

  subscribeSubtreeCommand(
    cmd: CommandEnvelope<'subscribeSubtree', ObserveSubtreePayload>
  ): Observable<TreeChangeEvent> {
    const { rootId, maxDepth, filter, includeInitialSnapshot = false, prefetch } = cmd.payload;
    const depthLimit = prefetch?.depth ?? 1;

    const subscriptionId = this.generateSubscriptionId();
    const subject = new Subject<TreeChangeEvent>();

    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId as SubscriptionId,
      type: 'subtree',
      nodeId: rootId,
      options: { ...filter, maxDepth, prefetch },
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
    this.registry.register(subscriptionInfo);

    // Create observable that filters global changes for subtree
    const subtreeObservable = this.globalChangeSubject.pipe(
      mergeMap(async (event) =>
        (await this.isEventRelevantForSubtreeObservation(event, rootId, maxDepth, filter))
          ? event
          : null
      ),
      rxFilter((event): event is TreeChangeEvent => event !== null),
      // Progressive batching: on bursts, recompute current BFS snapshot and emit per-parent chunks
      bufferTime(30),
      rxFilter((batch) => batch.length > 0),
      mergeMap(async () => {
        const events: TreeChangeEvent[] = [];
        for await (const ev of this.createInitialSubtreeEvents(
          rootId,
          filter,
          maxDepth,
          200,
          depthLimit
        )) {
          events.push(ev);
        }
        return events;
      }),
      mergeMap((events) => from(events)),
      share()
    );

    // Subscribe to global changes and forward relevant ones
    const subscription = subtreeObservable.subscribe({
      next: (event) => {
        subject.next(event);
        this.updateSubscriptionActivity(subscriptionId);
      },
    });

    // Handle initial snapshot if requested
    let resultObservable: Observable<TreeChangeEvent> = subject.asObservable();

    if (includeInitialSnapshot) {
      const initial$ = from(
        this.createInitialSubtreeEvents(rootId, filter, maxDepth, 200, depthLimit)
      );
      resultObservable = concat(initial$, resultObservable);
    }

    // Set up unsubscribe handler
    /* eslint-disable deprecation/deprecation */
    const originalSubscribe = resultObservable.subscribe.bind(resultObservable);
    resultObservable.subscribe = ((...args: Parameters<typeof originalSubscribe>) => {
      const sub = originalSubscribe(...args);
      const originalUnsubscribe = sub.unsubscribe.bind(sub);
      sub.unsubscribe = () => {
        subscription.unsubscribe();
        this.deactivateSubscription(subscriptionId as SubscriptionId);
        originalUnsubscribe();
      };
      return sub;
    }) as typeof resultObservable.subscribe;
    /* eslint-enable deprecation/deprecation */

    return resultObservable;
  }

  subscribeWorkingCopies(
    cmd: CommandEnvelope<'subscribeWorkingCopies', ObserveWorkingCopiesPayload>
  ): Observable<TreeChangeEvent> {
    const { nodeId, includeAllDrafts = false } = cmd.payload;

    const subscriptionId = this.generateSubscriptionId();
    const subject = new Subject<TreeChangeEvent>();

    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      type: 'working-copies',
      nodeId: nodeId || ('all' as NodeId),
      filter: { properties: includeAllDrafts ? ['isDraft'] : [] },
      subject,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
    this.registry.register(subscriptionInfo);

    // For now, working copy events come through the same change stream
    // In a real implementation, this might have a separate event source
    const workingCopyObservable = this.globalChangeSubject.pipe(
      rxFilter((event) => this.isEventRelevantForWorkingCopies(event, nodeId)),
      map((event) => this.transformEventForSubscription(event)),
      share()
    );

    // Subscribe to global changes and forward relevant ones
    const subscription = workingCopyObservable.subscribe({
      next: (event) => {
        subject.next(event);
        this.updateSubscriptionActivity(subscriptionId);
      },
    });

    // Set up unsubscribe handler
    const resultObservable = subject.asObservable();
    /* eslint-disable deprecation/deprecation */
    const originalSubscribe = resultObservable.subscribe.bind(resultObservable);
    resultObservable.subscribe = ((...args: Parameters<typeof originalSubscribe>) => {
      const sub = originalSubscribe(...args);
      const originalUnsubscribe = sub.unsubscribe.bind(sub);
      sub.unsubscribe = () => {
        subscription.unsubscribe();
        this.deactivateSubscription(subscriptionId as SubscriptionId);
        originalUnsubscribe();
      };
      return sub;
    }) as typeof resultObservable.subscribe;
    /* eslint-enable deprecation/deprecation */

    return resultObservable;
  }

  getActiveSubscriptions(): Promise<number> {
    return Promise.resolve(this.registry.active().length);
  }

  cleanupInactiveSubscriptions(): Promise<void> {
    const now = Date.now();
    const maxInactiveTime = 5 * 60 * 1000; // 5 minutes

    const removed = this.registry.cleanupInactive(maxInactiveTime, now);
    for (const subscription of removed) {
      subscription.subject?.complete();
    }
    return Promise.resolve();
  }

  // Private helper methods

  private generateSubscriptionId(): SubscriptionId {
    return this.registry.generateId();
  }

  private updateSubscriptionActivity(subscriptionId: SubscriptionId): void {
    this.registry.updateActivity(subscriptionId);
  }

  private deactivateSubscription(subscriptionId: SubscriptionId): void {
    this.registry.markInactive(subscriptionId);
  }

  private isEventRelevantForNodeObservation(
    event: TreeChangeEvent,
    targetNodeId: NodeId,
    filter?: SubscriptionFilter
  ): boolean {
    // Must be about the specific node we're observing
    if (event.nodeId !== targetNodeId) {
      return false;
    }

    // Apply filter if provided
    if (filter?.nodeTypes && event.node) {
      if (!filter.nodeTypes.includes(event.node.nodeType)) {
        return false;
      }
    }

    return true;
  }

  private isEventRelevantForChildNodesObservation(
    event: TreeChangeEvent,
    parentId: NodeId,
    filter?: SubscriptionFilter
  ): boolean {
    // Check if this event is about a childNode of our target parentNode
    const isDirectChild = event.parentId === parentId || event.previousParentId === parentId;

    // For node deletions, we also need to check if the deleted node was a childNode
    if (event.type === 'node-deleted' && event.previousNode) {
      const wasChildNode = event.previousNode.parentId === parentId;
      if (!isDirectChild && !wasChildNode) {
        return false;
      }
    } else if (!isDirectChild) {
      return false;
    }

    // Apply filter if provided
    if (filter?.nodeTypes) {
      const nodeToCheck = event.node || event.previousNode;
      if (nodeToCheck && !filter.nodeTypes.includes(nodeToCheck.nodeType)) {
        return false;
      }
    }

    return true;
  }

  private async isEventRelevantForSubtreeObservation(
    event: TreeChangeEvent,
    rootNodeId: NodeId,
    maxDepthOrOptions?: number | SubscriptionOptions,
    filter?: SubscriptionFilter
  ): Promise<boolean> {
    // Handle overloaded parameters
    let maxDepth: number | undefined;
    let options: SubscriptionOptions | undefined;
    let legacyFilter: SubscriptionFilter | undefined;

    if (typeof maxDepthOrOptions === 'number') {
      // Legacy call: (event, rootNodeId, maxDepth, filter)
      maxDepth = maxDepthOrOptions;
      legacyFilter = filter;
    } else {
      // New API call: (event, rootNodeId, options)
      options = maxDepthOrOptions;
    }

    const currentNode = event.node ?? event.previousNode;
    const targetNodeId = currentNode?.id ?? event.nodeId;

    // Basic subtree check
    let isInSubtree = false;

    if (currentNode && maxDepth !== undefined) {
      isInSubtree = await this.isDescendantNodeByNode(currentNode, rootNodeId, maxDepth);
    } else if (currentNode) {
      isInSubtree = await this.isDescendantNode(
        currentNode.id,
        rootNodeId,
        options?.maxDepth,
        currentNode
      );
    } else if (targetNodeId) {
      isInSubtree = await this.isDescendantNode(targetNodeId, rootNodeId, options?.maxDepth);
    }

    // Fast-path: if we have the node payload and its direct parent is the root, accept
    if (!isInSubtree && currentNode && currentNode.parentId === rootNodeId) {
      isInSubtree = true;
    }

    if (!isInSubtree && targetNodeId !== rootNodeId) {
      const candidateParent = event.parentId ?? event.previousParentId ?? currentNode?.parentId;
      if (candidateParent) {
        isInSubtree = await this.isDescendantNode(candidateParent, rootNodeId, options?.maxDepth);
      }
      if (!isInSubtree) {
        return false;
      }
    }

    // Apply legacy filter
    if (legacyFilter?.nodeTypes && event.node) {
      if (!legacyFilter.nodeTypes.includes(event.node.nodeType)) {
        return false;
      }
    }

    // Apply new API filters
    if (options?.excludeTypes && event.node?.nodeType) {
      return !options.excludeTypes.includes(event.node.nodeType);
    }

    // Apply depth filter for new API
    if (options?.depth !== undefined) {
      // Check exact depth match
      if (!event.node || event.node.depth !== options.depth) {
        return false;
      }
    }

    // Apply maxDepth filter
    if (options?.maxDepth !== undefined) {
      if (!event.node || event.node.depth > options.maxDepth) {
        return false;
      }
    }

    // Apply minDepth filter
    if (options?.minDepth !== undefined) {
      if (!event.node || event.node.depth < options.minDepth) {
        return false;
      }
    }

    return true;
  }

  private isEventRelevantForWorkingCopies(event: TreeChangeEvent, targetNodeId?: NodeId): boolean {
    // If targetNodeId is specified, only events about that node
    if (targetNodeId && event.nodeId !== targetNodeId) {
      return false;
    }

    // Working copy events would typically have specific indicators
    // For this implementation, we'll assume all events could be relevant
    return true;
  }

  private transformEventForSubscription(event: TreeChangeEvent): TreeChangeEvent {
    // Could add subscription-specific transformations here
    // For now, just return the event as-is
    return event;
  }

  private async createInitialNodeEventAsync(nodeId: NodeId): Promise<TreeChangeEvent> {
    const node = await this.coreDB.getNode(nodeId);
    return {
      type: 'node-updated',
      nodeId,
      node,
      timestamp: Date.now() as Timestamp,
    };
  }

  private async *createInitialChildNodesEvents(
    parentId: NodeId,
    filter?: SubscriptionFilter,
    chunkSize: number = 200,
    depthLimit: number = 1
  ): AsyncGenerator<TreeChangeEvent> {
    const queue: Array<{ parent: NodeId; depth: number }> = [{ parent: parentId, depth: 0 }];
    const visitedParents = new Set<string>();

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        continue;
      }
      const { parent, depth } = next;
      const parentKey = String(parent);
      if (visitedParents.has(parentKey)) {
        continue;
      }
      visitedParents.add(parentKey);

      const childrenRaw = await this.coreDB.listChildren(parent);
      let childNodes = childrenRaw;
      if (filter?.nodeTypes?.length) {
        const allowedTypes = filter.nodeTypes;
        childNodes = childNodes.filter((n) => allowedTypes?.includes(n.nodeType));
      }

      for (let i = 0; i < childNodes.length; i += chunkSize) {
        const slice = childNodes.slice(i, i + chunkSize);
        yield {
          type: 'children-changed',
          nodeId: parent,
          affectedChildren: slice.map((c) => c.id),
          timestamp: Date.now() as Timestamp,
        };
      }
      if (childNodes.length === 0) {
        yield {
          type: 'children-changed',
          nodeId: parent,
          affectedChildren: [],
          timestamp: Date.now() as Timestamp,
        };
      }

      if (depth + 1 < depthLimit) {
        for (const child of childrenRaw) {
          queue.push({ parent: child.id, depth: depth + 1 });
        }
      }
    }
  }

  private async *createInitialSubtreeEvents(
    rootId: NodeId,
    filter?: SubscriptionFilter,
    _maxDepth?: number,
    chunkSize: number = 200,
    depthLimit: number = 1
  ): AsyncGenerator<TreeChangeEvent> {
    yield* this.createInitialChildNodesEvents(rootId, filter, chunkSize, depthLimit);
  }

  private async getNodeFromDB(nodeId: NodeId): Promise<TreeNode | undefined> {
    try {
      return await this.coreDB.nodes.get(nodeId);
    } catch (error) {
      console.warn('Failed to fetch node from CoreDB:', error);
      return undefined;
    }
  }

  // getChildNodesFromDB omitted in this baseline (kept for legacy mock testing only)

  private setupPeriodicSubscriptionCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(
      () => {
        this.cleanupInactiveSubscriptions();
      },
      5 * 60 * 1000
    );
  }

  private async isDescendantNodeByNode(
    node: TreeNode,
    ancestorNodeId: NodeId,
    maxDepth?: number
  ): Promise<boolean> {
    // Handle the case where node is the ancestor itself
    if (node.id === ancestorNodeId) {
      return true;
    }

    // Direct childNode check (depth 1)
    if (node.parentId === ancestorNodeId) {
      return maxDepth === undefined || maxDepth >= 1;
    }

    // For deeper hierarchy, we would need to traverse up the console
    // For now, we'll use the database lookup method as fallback
    return this.isDescendantNode(node.id, ancestorNodeId, maxDepth, node);
  }

  private async isDescendantNode(
    nodeId: NodeId,
    ancestorNodeId: NodeId,
    maxDepth?: number,
    fallbackNode?: TreeNode
  ): Promise<boolean> {
    // Handle the case where nodeId is the ancestor itself
    if (nodeId === ancestorNodeId) {
      return true;
    }

    // Calculate the actual depth from ancestor to node
    const depthFromAncestor = await this.calculateDepth(nodeId, ancestorNodeId, fallbackNode);

    if (depthFromAncestor === -1) {
      return false; // Not a descendant
    }

    // If maxDepth is specified, check if the node is within the depth limit
    if (maxDepth !== undefined && depthFromAncestor > maxDepth) {
      return false;
    }

    return true;
  }

  // getInitialSubtreeV1 omitted (legacy compat stub)

  async searchByNameWithDepth(
    rootNodeId: NodeId,
    query: string,
    opts: {
      maxDepth: number; // Deprecated: kept for backward compatibility
      maxVisited?: number;
      maxResults?: number; // New: maximum number of search results to return
    }
  ): Promise<TreeNode[]> {
    return this.searchService.searchByNameWithDepth(rootNodeId, query, opts);
  }

  /**
   * Enhanced search API with multiple matching modes
   *
   * @param rootNodeId - Root node to search under
   * @param query - Search query string
   * @param opts - Search options including match mode and limits
   * @returns Promise<TreeNode[]> - Array of matching nodes
   */
  async searchByNameWithMatchMode(
    rootNodeId: NodeId,
    query: string,
    opts: {
      matchMode: 'exact' | 'prefix' | 'suffix' | 'partial';
      maxResults?: number;
      caseSensitive?: boolean;
      searchInDescription?: boolean;
    }
  ): Promise<TreeNode[]> {
    return this.searchService.searchByNameWithMatchMode(rootNodeId, query, opts);
  }

  private async calculateDepth(
    nodeId: NodeId,
    ancestorId: NodeId,
    fallbackNode?: TreeNode
  ): Promise<number> {
    // Self is depth 0
    if (nodeId === ancestorId) {
      return 0;
    }

    let node = await this.getNodeFromDB(nodeId);
    if (!node && fallbackNode && fallbackNode.id === nodeId) {
      node = fallbackNode;
    }
    if (!node) {
      return -1;
    }

    // Check if this is a direct childNode (depth 1)
    if (node.parentId === ancestorId) {
      return 1;
    }

    // Optimized ancestor traversal with depth limit
    const MAX_DEPTH = 50; // Prevent infinite loops and improve performance
    let currentNodeId = node.parentId;
    let depth = 1;
    const visited = new Set<NodeId>([nodeId]);

    while (currentNodeId && depth < MAX_DEPTH) {
      // Check for circular references
      if (visited.has(currentNodeId)) {
        break;
      }
      visited.add(currentNodeId);

      // Found the ancestor
      if (currentNodeId === ancestorId) {
        return depth;
      }

      let currentNode = await this.getNodeFromDB(currentNodeId);
      if (!currentNode && fallbackNode && fallbackNode.id === currentNodeId) {
        currentNode = fallbackNode;
      }
      if (!currentNode || !currentNode.parentId) {
        break;
      }

      currentNodeId = currentNode.parentId;
      depth++;
    }

    return -1; // Not a descendant or exceeded max depth
  }

  /**
   * Remove all active subscriptions
   *
   * @returns Total number of subscriptions that were removed
   */
  unsubscribeAll(): Promise<number> {
    const removed = this.registry.clear();
    for (const subscription of removed) {
      subscription.subject?.complete();
      subscription.subscription?.unsubscribe?.();
    }
    this.undoStateSubscriptions.clear();
    return Promise.resolve(removed.length);
  }

  // ==================
  // TreeSubscriptionAPI Implementation
  // ==================

  /**
   * Subscribe to changes for a specific node (TreeSubscriptionAPI)
   */
  async subscribeNode(
    nodeId: NodeId,
    callback: (event: TreeNodeEvent) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionId> {
    const subscriptionId = this.generateSubscriptionId() as SubscriptionId;

    // Set up the observable stream
    const stream = this.globalChangeSubject.pipe(
      rxFilter((event) => this.isEventRelevantForNodeObservation(event, nodeId)),
      map((event) => this.convertToTreeNodeEvent(event))
    );

    // Subscribe to the stream and store the subscription for cleanup
    const instrumentedCallback = (event: TreeNodeEvent) => {
      console.log('[TreeSubscriptionService][node] emit event', {
        subscriptionNodeId: String(nodeId),
        eventNodeId: String(event.nodeId),
        type: event.type,
        hasNode: Boolean(event.node),
      });
      callback(event);
    };

    const subscription = stream.subscribe(instrumentedCallback);

    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      type: 'node',
      nodeId,
      callback: callback as (event: unknown) => void,
      options,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
      // Store the RxJS subscription for cleanup
      subscription,
    };

    this.registry.register(subscriptionInfo);

    // Provide initial value if requested
    if (options?.includeMetadata) {
      try {
        const node = await this.getNodeFromDB(nodeId);
        if (node) {
          const initialEvent = this.createTreeNodeEvent('updated', node);
          callback(initialEvent);
        }
      } catch (error) {
        console.warn(`Failed to get initial value for node ${nodeId}:`, error);
      }
    }

    return subscriptionId;
  }

  /**
   * Subscribe to changes for an entire subtree (TreeSubscriptionAPI)
   */
  async subscribeSubtree(
    rootNodeId: NodeId,
    callback: (event: TreeNodeEvent) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionId> {
    const subscriptionId = this.generateSubscriptionId() as SubscriptionId;

    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      type: 'subtree',
      nodeId: rootNodeId,
      callback: callback as (event: unknown) => void,
      options,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    this.registry.register(subscriptionInfo);

    // Set up the observable stream
    const stream = this.globalChangeSubject.pipe(
      mergeMap(async (event) =>
        (await this.isEventRelevantForSubtreeObservation(event, rootNodeId, options))
          ? this.convertToTreeNodeEvent(event)
          : null
      ),
      rxFilter((event): event is TreeNodeEvent => event !== null)
    ) as Observable<TreeNodeEvent>;

    const subscription = stream.subscribe(callback);

    // Store the subscription for cleanup
    subscriptionInfo.subscription = subscription;

    if (options?.prefetch?.depth && options.prefetch.depth > 0) {
      try {
        const nodes = await this.coreDB.listChildren(rootNodeId, {
          prefetch: { depth: options.prefetch.depth },
        });
        const timestamp = Date.now() as Timestamp;
        for (const node of nodes) {
          callback({
            type: 'updated',
            nodeId: node.id,
            node,
            parentId: node.parentId,
            timestamp,
          });
        }
      } catch (error) {
        console.warn('[TreeSubscriptionService] Failed to deliver prefetch snapshot', error);
      }
    }

    return subscriptionId;
  }

  /**
   * Subscribe to all changes within a specific console (TreeSubscriptionAPI)
   */
  async subscribeTree(
    treeId: TreeId,
    callback: (event: TreeNodeEvent) => void,
    options?: SubscriptionOptions
  ): Promise<SubscriptionId> {
    const subscriptionId = this.generateSubscriptionId() as SubscriptionId;

    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      type: 'tree',
      treeId,
      callback: callback as (event: unknown) => void,
      options,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    this.registry.register(subscriptionInfo);

    // Set up the observable stream for entire console
    const stream = this.globalChangeSubject.pipe(
      rxFilter((event) => this.isEventRelevantForTreeObservation(event, treeId)),
      map((event) => this.convertToTreeNodeEvent(event))
    ) as Observable<TreeNodeEvent>;

    const subscription = stream.subscribe(callback);

    // Store the subscription for cleanup
    subscriptionInfo.subscription = subscription;

    return subscriptionId;
  }

  async subscribeUndoState(callback: (event: UndoStateEvent) => void): Promise<SubscriptionId> {
    const subscriptionId = this.generateSubscriptionId() as SubscriptionId;

    const subscriptionInfo: SubscriptionInfo = {
      id: subscriptionId,
      type: 'undo-state',
      callback: callback as (event: unknown) => void,
      isActive: true,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };

    this.registry.register(subscriptionInfo);
    this.undoStateSubscriptions.set(subscriptionId, callback);

    try {
      callback(this.latestUndoState);
    } catch (error) {
      console.warn('[TreeSubscriptionService] undo-state subscriber callback failed', error);
    }

    return subscriptionId;
  }

  /**
   * Remove a specific subscription (TreeSubscriptionAPI)
   */
  async unsubscribe(subscriptionId: SubscriptionId): Promise<void> {
    const subscription = this.registry.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;

      // Clean up RxJS subscription if present
      if (subscription.subscription) {
        subscription.subscription.unsubscribe();
      }

      // Clean up subject if present (for backward compatibility)
      if (subscription.subject) {
        subscription.subject.complete();
      }

      this.registry.delete(subscriptionId);
    }

    if (this.undoStateSubscriptions.has(subscriptionId)) {
      this.undoStateSubscriptions.delete(subscriptionId);
    }
  }

  /**
   * Remove all subscriptions for a specific node (TreeSubscriptionAPI)
   */
  async unsubscribeNode(nodeId: NodeId): Promise<number> {
    let count = 0;
    const toRemove: SubscriptionInfo[] = [];

    for (const [, subscription] of this.registry.entries()) {
      if (subscription.nodeId === nodeId) {
        subscription.isActive = false;

        // Clean up RxJS subscription if present
        if (subscription.subscription) {
          subscription.subscription.unsubscribe();
        }

        // Clean up subject if present (for backward compatibility)
        if (subscription.subject) {
          subscription.subject.complete();
        }

        toRemove.push(subscription);
        count++;
      }
    }

    for (const info of toRemove) {
      this.registry.delete(info.id);
    }

    return count;
  }

  /**
   * Remove all subscriptions for a specific console (TreeSubscriptionAPI)
   */
  async unsubscribeTree(treeId: TreeId): Promise<number> {
    let count = 0;
    const toRemove: SubscriptionInfo[] = [];

    for (const [, subscription] of this.registry.entries()) {
      if (subscription.treeId === treeId) {
        subscription.isActive = false;
        toRemove.push(subscription);
        count++;
      }
    }

    for (const info of toRemove) {
      this.registry.delete(info.id);
    }

    return count;
  }

  publishUndoState(event: UndoStateEvent): void {
    this.latestUndoState = event;
    for (const [subscriptionId, callback] of this.undoStateSubscriptions.entries()) {
      try {
        callback(event);
      } catch (error) {
        console.warn('[TreeSubscriptionService] undo-state callback threw', error);
      }
      const info = this.registry.get(subscriptionId);
      if (info) {
        info.lastActivity = Date.now();
      }
    }
  }

  /**
   * Get list of active subscription identifiers (TreeSubscriptionAPI)
   */
  async listActiveSubscriptions(): Promise<SubscriptionId[]> {
    return this.registry.listActiveIds();
  }

  /**
   * Check if a specific subscription is still active (TreeSubscriptionAPI)
   */
  async isSubscriptionActive(subscriptionId: SubscriptionId): Promise<boolean> {
    const subscription = this.registry.get(subscriptionId);
    return subscription ? subscription.isActive : false;
  }

  /**
   * Get subscription statistics (TreeSubscriptionAPI)
   */
  async getSubscriptionStats(): Promise<{
    totalActive: number;
    nodeSubscriptions: number;
    subtreeSubscriptions: number;
    treeSubscriptions: number;
    eventsProcessedToday: number;
    averageEventLatency: number;
  }> {
    const activeSubscriptions = this.registry.active();

    return {
      totalActive: activeSubscriptions.length,
      nodeSubscriptions: activeSubscriptions.filter((s) => s.type === 'node').length,
      subtreeSubscriptions: activeSubscriptions.filter((s) => s.type === 'subtree').length,
      treeSubscriptions: activeSubscriptions.filter((s) => s.type === 'tree').length,
      eventsProcessedToday: this.eventsProcessedToday,
      averageEventLatency: this.eventCount > 0 ? this.totalLatency / this.eventCount : 0,
    };
  }

  /**
   * Get recent events for a specific node (TreeSubscriptionAPI)
   */
  async getRecentEvents(nodeId: NodeId, limit: number = 50): Promise<TreeNodeEvent[]> {
    return this.eventHistory
      .filter((event) => event.nodeId === nodeId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get event history for a time range (TreeSubscriptionAPI)
   */
  async getEventHistory(
    startTime: number,
    endTime: number,
    nodeId?: NodeId
  ): Promise<TreeNodeEvent[]> {
    return this.eventHistory.filter((event) => {
      const inTimeRange = event.timestamp >= startTime && event.timestamp <= endTime;
      const nodeMatch = !nodeId || event.nodeId === nodeId;
      return inTimeRange && nodeMatch;
    });
  }

  // ==================
  // Helper Methods
  // ==================

  /**
   * Convert TreeChangeEvent to TreeNodeEvent
   */
  private convertToTreeNodeEvent(changeEvent: TreeChangeEvent): TreeNodeEvent {
    // Normalize event.type from CoreDB ('node-created' etc.) to public API ('created' etc.)
    const mapType = (t: string): 'created' | 'updated' | 'deleted' | 'moved' => {
      switch (t) {
        case 'node-created':
        case 'created':
          return 'created';
        case 'node-updated':
        case 'updated':
          return 'updated';
        case 'node-deleted':
        case 'deleted':
          return 'deleted';
        case 'node-moved':
        case 'moved':
          return 'moved';
        default:
          return 'updated';
      }
    };

    const nodeEvent: TreeNodeEvent = {
      nodeId: changeEvent.nodeId,
      type: mapType(changeEvent.type),
      timestamp: changeEvent.timestamp || Date.now(),
      node: changeEvent.node,
      parentId: changeEvent.node?.parentId,
      previousParentNodeId: changeEvent.previousNode?.parentId,
    };

    // Add to event history
    this.addToEventHistory(nodeEvent);

    return nodeEvent;
  }

  /**
   * Create a TreeNodeEvent from a node and event type
   */
  private createTreeNodeEvent(
    type: 'created' | 'updated' | 'deleted',
    node: TreeNode
  ): TreeNodeEvent {
    const event: TreeNodeEvent = {
      nodeId: node.id,
      type,
      timestamp: Date.now(),
      node: node,
      parentId: node.parentId,
    };

    this.addToEventHistory(event);
    return event;
  }

  /**
   * Add event to history with size management
   */
  private addToEventHistory(event: TreeNodeEvent): void {
    this.eventHistory.push(event);
    this.eventsProcessedToday++;

    // Maintain max history size
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
    }
  }

  /**
   * Check if event is relevant for console observation
   */
  private isEventRelevantForTreeObservation(_event: TreeChangeEvent, _treeId: TreeId): boolean {
    //  TreeChangeEventtreeIdnodeIdTreeId
    //  TODO: nodeIdTreeIdtreeId
    return true;
  }
}
