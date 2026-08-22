import { useIconRegistry } from '@hierarchidb/components';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import type { CreateMenuEntry, CreateMenuEntryInput } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { buildCreateMenuItems } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { type MouseEvent, useCallback, useMemo, useState } from 'react';
import type { SortMode } from '~/types/view-mode-types';

export interface UseBackgroundContextMenuArgs {
  treeId?: string;
  targetNodeId?: string;
  sortMode?: SortMode;
  showReorganize?: boolean;
  createItems?: CreateMenuEntryInput[];
  onContextAction?: (
    action: string,
    node: { id: string },
    options?: Record<string, unknown>
  ) => void;
  onReorganizeIcons?: () => void;
  onClose: () => void;
}

export function useBackgroundContextMenu(args: UseBackgroundContextMenuArgs) {
  const {
    treeId,
    targetNodeId,
    sortMode = 'none',
    showReorganize = true,
    createItems,
    onContextAction,
    onReorganizeIcons,
    onClose,
  } = args;

  const [createMenuAnchor, setCreateMenuAnchor] = useState<HTMLElement | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createSubmenuAnchor, setCreateSubmenuAnchor] = useState<HTMLElement | null>(null);
  const [createSubmenuOpen, setCreateSubmenuOpen] = useState(false);
  const [createSubmenuItems, setCreateSubmenuItems] = useState<CreateMenuEntry[]>([]);

  const { t } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();

  const translateWithFallback = useMemo(() => {
    return (key: string, fallback: string) => {
      const safeFallback = fallback?.trim?.() ?? '';
      const translated = t(key, safeFallback);
      if (translated === key) {
        return safeFallback || key;
      }
      return translated;
    };
  }, [t]);

  const reorganizeLabel = translateWithFallback(
    'treeConsole.contextMenu.reorganizeIcons',
    'Reorganize Icons'
  );
  const createLabel = translateWithFallback('treeConsole.contextMenu.create', 'Create');
  const importLabel = translateWithFallback('treeConsole.contextMenu.import', 'Import');
  const exportLabel = translateWithFallback('treeConsole.contextMenu.export', 'Export');

  const builtCreateItems = useMemo(
    () => buildCreateMenuItems(createItems, treeId),
    [createItems, treeId]
  );

  const isReorganizeDisabled = sortMode !== 'none';

  const handleClose = useCallback(() => {
    setCreateMenuOpen(false);
    setCreateMenuAnchor(null);
    setCreateSubmenuOpen(false);
    setCreateSubmenuAnchor(null);
    setCreateSubmenuItems([]);
    onClose();
  }, [onClose]);

  const handleCreateMenuClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setCreateMenuAnchor(menuItem as HTMLElement);
      setCreateMenuOpen(true);
    }
  }, []);

  const openCreateSubmenu = useCallback(
    (event: MouseEvent<HTMLElement>, children: CreateMenuEntry[]) => {
      event.stopPropagation();
      const menuItem = event.currentTarget.closest('li');
      if (!menuItem) return;
      setCreateSubmenuAnchor(menuItem as HTMLElement);
      setCreateSubmenuItems(children);
      setCreateSubmenuOpen(true);
    },
    []
  );

  const handleCreateSubmenuClose = useCallback(() => {
    setCreateSubmenuOpen(false);
    setCreateSubmenuAnchor(null);
    setCreateSubmenuItems([]);
  }, []);

  const handleCreateClick = useCallback(
    (type: string) => {
      onContextAction?.(`create:${type}`, { id: targetNodeId ?? '' });
      handleClose();
    },
    [onContextAction, targetNodeId, handleClose]
  );

  const handleImportClick = useCallback(() => {
    onContextAction?.('import', { id: targetNodeId ?? '' });
    handleClose();
  }, [onContextAction, targetNodeId, handleClose]);

  const handleExportClick = useCallback(() => {
    onContextAction?.('export', { id: targetNodeId ?? '' });
    handleClose();
  }, [onContextAction, targetNodeId, handleClose]);

  const handleReorganizeClick = useCallback(() => {
    onReorganizeIcons?.();
    handleClose();
  }, [onReorganizeIcons, handleClose]);

  return {
    // Create submenu state
    createMenuOpen,
    createMenuAnchor,
    createSubmenuOpen,
    createSubmenuAnchor,
    createSubmenuItems,
    builtCreateItems,
    // Labels
    reorganizeLabel,
    createLabel,
    importLabel,
    exportLabel,
    // State
    isReorganizeDisabled,
    showReorganize,
    // Handlers
    handleCreateMenuClick,
    openCreateSubmenu,
    handleCreateClick,
    handleImportClick,
    handleExportClick,
    handleReorganizeClick,
    handleClose,
    handleCreateSubmenuClose,
    // Icon/i18n resolution
    translateWithFallback,
    resolveIcon,
  };
}
