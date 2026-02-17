import type { TreeConsoleToolbarController } from '../../types.js';
import { TreeTableSearchInput } from '@hierarchidb/ui-search-input';

export interface SearchStrings {
  placeholder: string;
  ariaLabel: string;
}

interface SearchOnlyToolbarProps {
  controller?: TreeConsoleToolbarController | null;
  searchStrings: SearchStrings;
}

export function SearchOnlyToolbar({
  controller,
  searchStrings,
}: SearchOnlyToolbarProps) {
  return (
    <TreeTableSearchInput
      fullWidth
      searchText={controller?.searchText || ''}
      handleSearchTextChange={controller?.handleSearchTextChange || (() => {})}
      handleSearchCommit={controller?.handleSearchCommit}
      placeholder={searchStrings.placeholder}
      ariaLabel={searchStrings.ariaLabel}
      searchMode="local"
    />
  );
}
