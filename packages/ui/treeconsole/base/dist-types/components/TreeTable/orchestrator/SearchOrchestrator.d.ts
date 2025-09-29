/**
  * SearchOrchestrator
   * -
 * -
 * -
  */
import type { TreeViewController } from '../../../types/index.js';
export interface SearchOrchestratorResult {
    searchTerm: string;
    isSearching: boolean;
    resultCount: number;
    updateSearchTerm: (term: string) => void;
    clearSearch: () => void;
    searchWithDebounce: (term: string, delay?: number) => void;
}
/**
    */
export declare function useSearchOrchestrator(controller: TreeViewController | null): SearchOrchestratorResult;
//# sourceMappingURL=SearchOrchestrator.d.ts.map