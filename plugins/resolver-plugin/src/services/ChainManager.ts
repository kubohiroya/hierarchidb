import type { NodeId } from '@hierarchidb/core-types';

/**
 * Chain execution strategies
 */
export type ChainStrategy =
  | 'sequential' // Execute resolvers one after another
  | 'parallel' // Execute resolvers in parallel and merge results
  | 'conditional' // Execute based on conditions
  | 'fallback' // Try resolvers until one succeeds
  | 'weighted'; // Weighted merge of parallel results

/**
 * Conflict resolution strategies when merging results
 */
export type ConflictResolution =
  | 'last-wins' // Use the last value
  | 'first-wins' // Keep the first value
  | 'merge' // Merge values
  | 'error' // Throw error on conflict
  | 'custom'; // Custom resolution function

/**
 * Individual resolver in a chain
 */
export interface ResolverChainItem {
  resolverId: NodeId;
  order: number;
  condition?: string; // JavaScript condition expression
  scope?: 'all' | 'partial'; // Apply to all or partial data
  weight?: number; // Weight for weighted merge (0-1)
  enabled: boolean;
}

/**
 * Resolver chain configuration
 */
export interface ResolverChain {
  id: string;
  name: string;
  description?: string;
  resolvers: ResolverChainItem[];
  strategy: ChainStrategy;
  conflictResolution: ConflictResolution;
  conflictResolver?: string; // Custom resolution function
  metadata: {
    createdAt: number;
    updatedAt: number;
    lastExecutedAt?: number;
    executionCount: number;
    averageExecutionTime?: number;
  };
}

/**
 * Chain execution result
 */
export interface ChainExecutionResult {
  success: boolean;
  data: any;
  errors: Array<{
    resolverId: NodeId;
    error: string;
  }>;
  statistics: {
    totalResolvers: number;
    successfulResolvers: number;
    failedResolvers: number;
    executionTime: number;
    recordsProcessed: number;
  };
  resolverResults: Map<NodeId, any>;
}

type ResolverExecutionResult = {
  resolverId: NodeId;
  data: unknown;
  weight: number;
};

/**
 * Manager for Resolver chains
 */
export class ChainManager {
  private chains: Map<string, ResolverChain> = new Map();

  // private resolverCache: Map<NodeId, ResolverEntity> = new Map();

  /**
   * Create a new resolver chain
   */
  async createChain(config: Omit<ResolverChain, 'id' | 'metadata'>): Promise<ResolverChain> {
    const chain: ResolverChain = {
      ...config,
      id: crypto.randomUUID(),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        executionCount: 0,
      },
    };

    this.chains.set(chain.id, chain);
    return chain;
  }

  /**
   * Execute a resolver chain
   */
  async executeChain(
    chainId: string,
    data: any,
    _options?: {
      timeout?: number;
      parallel?: boolean;
      cache?: boolean;
    }
  ): Promise<ChainExecutionResult> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }

    const startTime = performance.now();
    const result: ChainExecutionResult = {
      success: false,
      data: null,
      errors: [],
      statistics: {
        totalResolvers: chain.resolvers.length,
        successfulResolvers: 0,
        failedResolvers: 0,
        executionTime: 0,
        recordsProcessed: Array.isArray(data) ? data.length : 1,
      },
      resolverResults: new Map(),
    };

    try {
      switch (chain.strategy) {
        case 'sequential':
          result.data = await this.executeSequential(chain, data, result);
          break;
        case 'parallel':
          result.data = await this.executeParallel(chain, data, result);
          break;
        case 'conditional':
          result.data = await this.executeConditional(chain, data, result);
          break;
        case 'fallback':
          result.data = await this.executeFallback(chain, data, result);
          break;
        case 'weighted':
          result.data = await this.executeWeighted(chain, data, result);
          break;
        default:
          throw new Error(`Unknown strategy: ${chain.strategy}`);
      }

      result.success = true;
    } catch (error) {
      console.error('Chain execution failed:', error);
      result.errors.push({
        resolverId: '' as NodeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      result.statistics.executionTime = performance.now() - startTime;

      // Update chain metadata
      chain.metadata.lastExecutedAt = Date.now();
      chain.metadata.executionCount++;
      chain.metadata.averageExecutionTime =
        ((chain.metadata.averageExecutionTime || 0) * (chain.metadata.executionCount - 1) +
          result.statistics.executionTime) /
        chain.metadata.executionCount;
    }

    return result;
  }

  /**
   * Sequential execution strategy
   */
  private async executeSequential(
    chain: ResolverChain,
    data: any,
    result: ChainExecutionResult
  ): Promise<any> {
    let currentData = data;

    const sortedResolvers = [...chain.resolvers]
      .filter((r) => r.enabled)
      .sort((a, b) => a.order - b.order);

    for (const resolver of sortedResolvers) {
      try {
        currentData = await this.executeResolver(resolver.resolverId, currentData);
        result.resolverResults.set(resolver.resolverId, currentData);
        result.statistics.successfulResolvers++;
      } catch (error) {
        result.statistics.failedResolvers++;
        result.errors.push({
          resolverId: resolver.resolverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // In sequential mode, stop on error
        throw error;
      }
    }

    return currentData;
  }

  /**
   * Parallel execution strategy
   */
  private async executeParallel(
    chain: ResolverChain,
    data: any,
    result: ChainExecutionResult
  ): Promise<any> {
    const enabledResolvers = chain.resolvers.filter((r) => r.enabled);

    const promises = enabledResolvers.map(
      async (resolver): Promise<ResolverExecutionResult | null> => {
        try {
          const resolvedData = await this.executeResolver(resolver.resolverId, data);
          result.resolverResults.set(resolver.resolverId, resolvedData);
          result.statistics.successfulResolvers++;
          return {
            resolverId: resolver.resolverId,
            data: resolvedData,
            weight: resolver.weight || 1,
          };
        } catch (error) {
          result.statistics.failedResolvers++;
          result.errors.push({
            resolverId: resolver.resolverId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return null;
        }
      }
    );

    const results = (await Promise.all(promises)).filter(
      (r): r is ResolverExecutionResult => r !== null
    );

    // Merge results based on conflict resolution strategy
    return this.mergeResults(results, chain.conflictResolution);
  }

  /**
   * Conditional execution strategy
   */
  private async executeConditional(
    chain: ResolverChain,
    data: any,
    result: ChainExecutionResult
  ): Promise<any> {
    for (const resolver of chain.resolvers) {
      if (!resolver.enabled) continue;

      // Evaluate condition
      if (resolver.condition) {
        try {
          const conditionFunc = new Function('data', `return ${resolver.condition}`);
          if (!conditionFunc(data)) {
            continue; // Skip this resolver
          }
        } catch (error) {
          console.error(`Failed to evaluate condition for resolver ${resolver.resolverId}:`, error);
          continue;
        }
      }

      try {
        const resolvedData = await this.executeResolver(resolver.resolverId, data);
        result.resolverResults.set(resolver.resolverId, resolvedData);
        result.statistics.successfulResolvers++;
        return resolvedData; // Return first matching result
      } catch (error) {
        result.statistics.failedResolvers++;
        result.errors.push({
          resolverId: resolver.resolverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return data; // Return original data if no conditions matched
  }

  /**
   * Fallback execution strategy
   */
  private async executeFallback(
    chain: ResolverChain,
    data: any,
    result: ChainExecutionResult
  ): Promise<any> {
    const sortedResolvers = [...chain.resolvers]
      .filter((r) => r.enabled)
      .sort((a, b) => a.order - b.order);

    for (const resolver of sortedResolvers) {
      try {
        const resolvedData = await this.executeResolver(resolver.resolverId, data);
        result.resolverResults.set(resolver.resolverId, resolvedData);
        result.statistics.successfulResolvers++;
        return resolvedData; // Return first successful result
      } catch (error) {
        result.statistics.failedResolvers++;
        result.errors.push({
          resolverId: resolver.resolverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue to next resolver
      }
    }

    throw new Error('All resolvers in fallback chain failed');
  }

  /**
   * Weighted merge execution strategy
   */
  private async executeWeighted(
    chain: ResolverChain,
    data: any,
    result: ChainExecutionResult
  ): Promise<any> {
    // Similar to parallel, but with weighted merging
    return this.executeParallel(chain, data, result);
  }

  /**
   * Execute a single resolver (mock implementation)
   */
  private async executeResolver(resolverId: NodeId, data: any): Promise<any> {
    // In real implementation, this would:
    // 1. Load the resolver configuration
    // 2. Apply mapping rules
    // 3. Apply validations
    // 4. Handle duplicates
    // 5. Return transformed data

    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...data, _processed: true, _resolverId: resolverId });
      }, Math.random() * 100);
    });
  }

  /**
   * Merge results from parallel execution
   */
  private mergeResults(results: ResolverExecutionResult[], strategy: ConflictResolution): any {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0]?.data;

    switch (strategy) {
      case 'last-wins':
        return results[results.length - 1]?.data;

      case 'first-wins':
        return results[0]?.data;

      case 'merge':
        // Deep merge all results
        return results.reduce((acc, r) => this.deepMerge(acc, r?.data), {});

      case 'error':
        throw new Error('Conflict detected in parallel execution');

      case 'custom':
        // Would use custom resolver function
        return results[0]?.data;

      default:
        return results[0]?.data;
    }
  }

  /**
   * Deep merge helper
   */
  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };

    for (const key in source) {
      if (Object.hasOwn(source, key)) {
        if (
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          source[key] !== null
        ) {
          result[key] = this.deepMerge(target?.[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Get all chains
   */
  getChains(): ResolverChain[] {
    return Array.from(this.chains.values());
  }

  /**
   * Get chain by ID
   */
  getChain(chainId: string): ResolverChain | undefined {
    return this.chains.get(chainId);
  }

  /**
   * Update chain configuration
   */
  updateChain(chainId: string, updates: Partial<ResolverChain>): ResolverChain {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not found`);
    }

    const updated = {
      ...chain,
      ...updates,
      metadata: {
        ...chain.metadata,
        updatedAt: Date.now(),
      },
    };

    this.chains.set(chainId, updated);
    return updated;
  }

  /**
   * Delete a chain
   */
  deleteChain(chainId: string): boolean {
    return this.chains.delete(chainId);
  }
}
