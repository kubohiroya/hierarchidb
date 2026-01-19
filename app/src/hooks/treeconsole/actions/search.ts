/**
 * Search actions for TreeConsole.
 */

import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeConsoleSearchMode } from '@hierarchidb/ui-treeconsole-toolbar';
import type { TreeConsoleActionDeps } from '../types.js';
import { buildIndexFromNodes } from './helpers.ts';

export const createSearchActions = (deps: TreeConsoleActionDeps) => {
  const { client, pageNodeId, loadChildrenOf, setSSOT, locale, pushPath, searchMode, searchTerm } =
    deps;

  const runLocalSearch = async (term: string) => {
    if (!client) return;
    const root = pageNodeId as NodeId;
    const trimmed = term.trim();
    if (!trimmed) {
      await loadChildrenOf(root, '');
      return;
    }
    try {
      const queryAPI = await client.getQueryAPI();
      const results = (await queryAPI.searchNodes({
        rootNodeId: root,
        query: trimmed,
        mode: 'partial',
        maxResults: 200,
      })) as TreeNode[];
      const index = buildIndexFromNodes(results, root);
      setSSOT({ nodeIndex: index });
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const runFulltextSearch = async (term: string) => {
    if (!client) return;
    const root = pageNodeId as NodeId;
    const trimmed = term.trim();
    if (!trimmed) {
      await loadChildrenOf(root, '');
      return;
    }
    try {
      const queryAPI = await client.getQueryAPI();
      const effectiveLocale = locale ?? 'en';
      const results = (await queryAPI.searchNodesFulltext({
        rootNodeId: root,
        query: trimmed,
        maxResults: 200,
        locale: effectiveLocale,
      })) as TreeNode[];
      const index = buildIndexFromNodes(results, root);
      setSSOT({ nodeIndex: index });
    } catch (error) {
      console.error('Full-text search failed:', error);
    }
  };

  return {
    runLocalSearch,
    runFulltextSearch,
    handleSearchChange: async (term: string) => {
      setSSOT({ searchTerm: term });
      if (searchMode === 'local') {
        await runLocalSearch(term);
      } else {
        await runFulltextSearch(term);
      }
    },

    handleSearchClear: () => {
      setSSOT({ searchTerm: '' });
      const root = pageNodeId as NodeId;
      void loadChildrenOf(root, '');
      if (pushPath) {
        const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        sp.delete('q');
        const nextSearch = sp.toString();
        pushPath(nextSearch ? `?${nextSearch}` : '?');
      }
    },

    handleSearchCommit: () => {
      if (!pushPath) return;
      const term = (searchTerm || '').trim();
      const next = term ? `?q=${encodeURIComponent(term)}` : '?';
      const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
      if (currentSearch !== (next === '?' ? '' : next)) pushPath(next);
    },

    handleSearchModeChange: (mode: TreeConsoleSearchMode) => {
      if (mode === searchMode) return;
      setSSOT({ searchMode: mode });
      if (mode === 'local') {
        void runLocalSearch(searchTerm);
      } else {
        void runFulltextSearch(searchTerm);
      }
    },
  };
};
