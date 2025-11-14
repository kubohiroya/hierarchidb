import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeQueryAPI } from '@hierarchidb/common-api';

type DepthSearchOptions = {
  maxDepth: number;
  maxVisited?: number;
  maxResults?: number;
};

type MatchMode = 'exact' | 'prefix' | 'suffix' | 'partial';

type MatchModeOptions = {
  matchMode: MatchMode;
  maxResults?: number;
  caseSensitive?: boolean;
  searchInDescription?: boolean;
};

/**
 * Encapsulates TreeQueryService search operations that were previously
 * implemented directly on TreeSubscriptionService. Keeping them here keeps
 * TreeSubscriptionService focused on subscription management.
 */
export class TreeSearchService {
  constructor(private readonly treeQuery: TreeQueryAPI) {}

  async searchByNameWithDepth(
    rootNodeId: NodeId,
    query: string,
    opts: DepthSearchOptions
  ): Promise<TreeNode[]> {
    try {
      const searchResults = await this.treeQuery.searchNodes({
        query,
        rootNodeId,
        caseSensitive: false,
        searchInDescription: false,
      });

      const maxResults = opts.maxResults ?? opts.maxVisited ?? 100;
      return searchResults.slice(0, maxResults);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  async searchByNameWithMatchMode(
    rootNodeId: NodeId,
    query: string,
    opts: MatchModeOptions
  ): Promise<TreeNode[]> {
    try {
      const searchPattern = this.buildSearchPattern(query, opts.matchMode);

      const searchResults = await this.treeQuery.searchNodes({
        query: searchPattern,
        rootNodeId,
        caseSensitive: opts.caseSensitive ?? false,
        searchInDescription: opts.searchInDescription ?? false,
      });

      const maxResults = opts.maxResults ?? 100;
      return searchResults.slice(0, maxResults);
    } catch (error) {
      console.error('Enhanced search failed:', error);
      return [];
    }
  }

  private buildSearchPattern(query: string, mode: MatchMode): string {
    switch (mode) {
      case 'exact':
        return `^${this.escapeRegexChars(query)}$`;
      case 'prefix':
        return `^${this.escapeRegexChars(query)}`;
      case 'suffix':
        return `${this.escapeRegexChars(query)}$`;
      default:
        return query;
    }
  }

  private escapeRegexChars(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export type { DepthSearchOptions, MatchModeOptions };
