import { ScreenSearchDesktop as ScreenSearchDesktopIcon, Search as SearchIcon } from '@mui/icons-material';
import { useState } from 'react';
import type { TreeConsoleSearchMode, TreeConsoleToolbarController } from '../../types.js';
import { SearchField } from './SearchField.js';
import { SearchModeMenu } from './SearchModeMenu.js';

export interface SearchStrings {
  placeholder: string;
  ariaLabel: string;
  localLabel: string;
  localDescription: string;
  fulltextLabel: string;
  fulltextDescription: string;
  menuLabel: string;
}

interface SearchOnlyToolbarProps {
  controller?: TreeConsoleToolbarController | null;
  searchStrings: SearchStrings;
}

export function SearchOnlyToolbar({
  controller,
  searchStrings,
}: SearchOnlyToolbarProps) {
  const [searchOnlyAnchorEl, setSearchOnlyAnchorEl] = useState<HTMLElement | null>(null);
  const currentSearchMode: TreeConsoleSearchMode = controller?.searchMode ?? 'local';
  const searchModeIcon =
    currentSearchMode === 'fulltext' ? (
      <ScreenSearchDesktopIcon fontSize="small" />
    ) : (
      <SearchIcon fontSize="small" />
    );

  const openSearchModeMenu = (event: React.MouseEvent<HTMLElement>) => {
    setSearchOnlyAnchorEl(event.currentTarget);
  };
  const closeSearchModeMenu = () => setSearchOnlyAnchorEl(null);

  const handleSearchModeSelect = (mode: TreeConsoleSearchMode) => {
    controller?.onSearchModeChange?.(mode);
    closeSearchModeMenu();
  };

  return (
    <>
      <SearchField
        fullWidth
        searchText={controller?.searchText || ''}
        handleSearchTextChange={controller?.handleSearchTextChange || (() => {})}
        handleSearchCommit={controller?.handleSearchCommit}
        placeholder={searchStrings.placeholder}
        ariaLabel={searchStrings.ariaLabel}
        searchMode={currentSearchMode}
        onSearchModeButtonClick={openSearchModeMenu}
        searchModeIcon={searchModeIcon}
        searchModeAriaLabel={searchStrings.menuLabel}
      />
      <SearchModeMenu
        anchorEl={searchOnlyAnchorEl}
        open={Boolean(searchOnlyAnchorEl)}
        onClose={closeSearchModeMenu}
        currentMode={currentSearchMode}
        onSelect={handleSearchModeSelect}
        localLabel={searchStrings.localLabel}
        localDescription={searchStrings.localDescription}
        fulltextLabel={searchStrings.fulltextLabel}
        fulltextDescription={searchStrings.fulltextDescription}
      />
    </>
  );
}
