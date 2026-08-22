import { useIconRegistry } from '@hierarchidb/components';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFolderNodeType } from '~/utils/nodeTypeIconColor';
import type { CreateMenuEntry } from './buildCreateMenuItems.js';
import { buildCreateMenuItems } from './buildCreateMenuItems.js';
import type { NodeContextMenuProps } from './NodeContextMenu';

const buildableNodeTypes = new Set(['styler', 'shape', 'route']);

const logNodeContextMenuWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[NodeContextMenu]', message, error);
};

export type UseNodeContextMenuResult = {
  addMenuOpen: boolean;
  addMenuAnchor: HTMLElement | null;
  createSubmenuOpen: boolean;
  createSubmenuAnchor: HTMLElement | null;
  createSubmenuItems: CreateMenuEntry[];
  openStepMenuOpen: boolean;
  openStepMenuAnchor: HTMLElement | null;
  isShiftPressed: boolean;
  language: string;
  createLabel: string;
  openFolderLabel: string;
  openLabel: string;
  editLabel: string;
  copyLabel: string;
  cutLabel: string;
  duplicateLabel: string;
  moveToArchiveLabel: string;
  importLabel: string;
  exportLabel: string;
  allowArchive: boolean;
  visibleLabel: string;
  hiddenLabel: string;
  previewLabel: string;
  buildLabel: string;
  effectiveVisible: boolean;
  effectiveInvisible: boolean;
  canPreview: boolean;
  showBuildEntry: boolean;
  buildDisabled: boolean;
  anchorReference: 'anchorEl' | 'anchorPosition';
  resolvedAnchorPosition: { top: number; left: number } | null;
  anchorForMenu: HTMLElement | null;
  isFolder: boolean;
  hasOpenSteps: boolean;
  showImport: boolean;
  showExport: boolean;
  builtCreateItems: CreateMenuEntry[];
  translateWithFallback: (key: string, fallback: string) => string;
  resolveIcon: ReturnType<typeof useIconRegistry>['resolveIcon'];
  handleAddMenuClick: (event: MouseEvent<HTMLElement>) => void;
  openCreateSubmenu: (event: MouseEvent<HTMLElement>, children: CreateMenuEntry[]) => void;
  handleOpenStepMenuClick: (event: MouseEvent<HTMLElement>) => void;
  handleMainMenuClose: () => void;
  handleOpenClick: (event?: MouseEvent<HTMLElement>) => void;
  handleOpenStepClick: (step: number, event?: MouseEvent<HTMLElement>) => void;
  handleOpenFolderClick: (event?: MouseEvent<HTMLElement>) => void;
  handleEditClick: (event?: MouseEvent<HTMLElement>) => void;
  handleCreateClick: (type: string, event?: MouseEvent<HTMLElement>) => void;
  handleDuplicateClick: () => void;
  handleArchiveClick: () => void;
  handleCopyClick: () => void;
  handleCutClick: () => void;
  handleImportClick: () => void;
  handleExportClick: () => void;
  handlePreviewClick: (event?: MouseEvent<HTMLElement>) => void;
  handleBuildClick: (event?: MouseEvent<HTMLElement>) => void;
  handleToggleVisible: () => void;
  handleCreateSubmenuClose: () => void;
};

export function useNodeContextMenu(props: NodeContextMenuProps): UseNodeContextMenuResult {
  const {
    anchorEl,
    anchorPosition,
    open,
    onClose,
    nodeType = 'folder',
    treeId,
    canRemove,
    canArchive = true,
    canImport = true,
    canExport = true,
    folderBuildReady,
    buildRequired,
    canBuild,
    canPreview: canPreviewOverride,
    isVisible,
    openSteps = [],
    openStepsLoading = false,
  } = props;

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [createSubmenuOpen, setCreateSubmenuOpen] = useState(false);
  const [createSubmenuAnchor, setCreateSubmenuAnchor] = useState<HTMLElement | null>(null);
  const [createSubmenuItems, setCreateSubmenuItems] = useState<CreateMenuEntry[]>([]);
  const [openStepMenuOpen, setOpenStepMenuOpen] = useState(false);
  const [openStepMenuAnchor, setOpenStepMenuAnchor] = useState<HTMLElement | null>(null);
  const [localInvisible, setLocalInvisible] = useState<boolean | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const { t, language } = useGlobalI18nTranslator();
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

  const createLabel = translateWithFallback('treeConsole.contextMenu.create', 'Create');
  const openFolderLabel = translateWithFallback(
    'treeConsole.contextMenu.openFolder',
    'Open Folder'
  );
  const openLabel = translateWithFallback('treeConsole.contextMenu.open', 'Open');
  const editLabel = translateWithFallback('treeConsole.contextMenu.edit', 'Edit');
  const copyLabel = translateWithFallback('treeConsole.contextMenu.copy', 'Copy');
  const cutLabel = translateWithFallback('treeConsole.contextMenu.cut', 'Cut');
  const duplicateLabel = translateWithFallback('treeConsole.contextMenu.duplicate', 'Duplicate');
  const moveToArchiveLabel = translateWithFallback(
    'treeConsole.contextMenu.moveToArchive',
    'Move to Archive'
  );
  const importLabel = translateWithFallback('treeConsole.contextMenu.import', 'Import');
  const exportLabel = translateWithFallback('treeConsole.contextMenu.export', 'Export');
  const allowArchive =
    (typeof canArchive === 'boolean' ? canArchive : undefined) ?? canRemove ?? true;
  const visibleLabel = translateWithFallback('treeConsole.contextMenu.visible', 'Visible');
  const hiddenLabel = translateWithFallback('treeConsole.contextMenu.hidden', 'Hidden');
  const previewLabel = translateWithFallback('treeConsole.contextMenu.preview', 'Preview');
  const buildLabel = translateWithFallback('treeConsole.contextMenu.build', 'Build');

  const effectiveVisible =
    localInvisible !== null ? !localInvisible : typeof isVisible === 'boolean' ? isVisible : true;
  const effectiveInvisible = !effectiveVisible;
  const canPreview =
    typeof canPreviewOverride === 'boolean' ? canPreviewOverride : !effectiveInvisible;
  const normalizedNodeType = String(nodeType ?? '')
    .trim()
    .toLowerCase();
  const isLocationNode = normalizedNodeType === 'location';
  const isFolderNode = isFolderNodeType(nodeType);
  const folderBuildReadyForNode =
    typeof folderBuildReady === 'boolean' ? folderBuildReady : undefined;
  const nodeBuildRequired = typeof buildRequired === 'boolean' ? buildRequired : undefined;
  const isBuildAllowed = typeof nodeBuildRequired === 'boolean' ? nodeBuildRequired : true;
  const canBuildForNode = (() => {
    if (typeof canBuild === 'boolean') return canBuild;
    if (isFolderNode) {
      return typeof folderBuildReadyForNode === 'boolean' ? folderBuildReadyForNode : isFolderNode;
    }
    if (typeof nodeBuildRequired === 'boolean') {
      return nodeBuildRequired;
    }
    return buildableNodeTypes.has(normalizedNodeType);
  })();

  const canBuildEntry = Boolean(props.onBuild) && canBuildForNode && isBuildAllowed;
  const showBuildEntry = Boolean(props.onBuild) && (canBuildForNode || isLocationNode);
  const buildDisabled = !canBuildEntry || isLocationNode;

  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!open) {
      setLocalInvisible(null);
      return;
    }
    const resolvedVisible = typeof isVisible === 'boolean' ? isVisible : true;
    if (localInvisible !== null && localInvisible === !resolvedVisible) {
      setLocalInvisible(null);
    }
  }, [open, isVisible, localInvisible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    const onBlur = () => {
      setIsShiftPressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handleAddMenuClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setAddMenuAnchor(menuItem as HTMLElement);
      setAddMenuOpen(true);
    }
  }, []);

  const openCreateSubmenu = useCallback(
    (event: MouseEvent<HTMLElement>, children: CreateMenuEntry[]) => {
      event.stopPropagation();
      event.preventDefault();
      const menuItem = event.currentTarget.closest('li');
      if (!menuItem) return;
      setCreateSubmenuAnchor(menuItem as HTMLElement);
      setCreateSubmenuItems(children);
      setCreateSubmenuOpen(true);
    },
    []
  );

  const handleOpenStepMenuClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setOpenStepMenuAnchor(menuItem as HTMLElement);
      setOpenStepMenuOpen(true);
    }
  }, []);

  const handleMainMenuClose = useCallback(() => {
    setAddMenuOpen(false);
    setAddMenuAnchor(null);
    setCreateSubmenuOpen(false);
    setCreateSubmenuAnchor(null);
    setCreateSubmenuItems([]);
    setOpenStepMenuOpen(false);
    setOpenStepMenuAnchor(null);
    onClose();
  }, [onClose]);

  const handleCreateSubmenuClose = useCallback(() => {
    setCreateSubmenuOpen(false);
    setCreateSubmenuAnchor(null);
    setCreateSubmenuItems([]);
  }, []);

  const blurActive = useCallback(() => {
    try {
      const el = (globalThis?.document?.activeElement ?? null) as HTMLElement | null;
      el?.blur?.();
    } catch (error) {
      logNodeContextMenuWarning('Failed to blur active element', error);
    }
  }, []);

  const resolveOpenInNew = useCallback(
    (event?: MouseEvent<HTMLElement>) => Boolean(event?.shiftKey || isShiftPressed),
    [isShiftPressed]
  );

  const handleOpenClick = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      const onOpen = propsRef.current.onOpen;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onOpen?.({ openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleOpenStepClick = useCallback(
    (step: number, event?: MouseEvent<HTMLElement>) => {
      const onOpenStep = propsRef.current.onOpenStep;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onOpenStep?.(step, { openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleOpenFolderClick = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      const onOpenFolder = propsRef.current.onOpenFolder;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onOpenFolder?.({ openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleEditClick = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      const onEdit = propsRef.current.onEdit;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onEdit?.({ openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleCreateClick = useCallback(
    (type: string, event?: MouseEvent<HTMLElement>) => {
      const onCreate = propsRef.current.onCreate;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onCreate?.(type, { openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleDuplicateClick = useCallback(() => {
    const onDuplicate = propsRef.current.onDuplicate;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => {
      onDuplicate?.();
    }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleArchiveClick = useCallback(() => {
    const current = propsRef.current;
    const handler = current.onArchive ?? current.onRemove;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => {
      handler?.();
    }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleCopyClick = useCallback(() => {
    const onCopy = propsRef.current.onCopy;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => {
      onCopy?.();
    }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleCutClick = useCallback(() => {
    const onCut = propsRef.current.onCut;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => {
      onCut?.();
    }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleImportClick = useCallback(() => {
    const onImport = propsRef.current.onImport;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => {
      onImport?.();
    }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handleExportClick = useCallback(() => {
    const onExport = propsRef.current.onExport;
    blurActive();
    handleMainMenuClose();
    setTimeout(() => {
      onExport?.();
    }, 0);
  }, [blurActive, handleMainMenuClose]);

  const handlePreviewClick = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      const onPreview = propsRef.current.onPreview;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onPreview?.({ openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleBuildClick = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      const onBuild = propsRef.current.onBuild;
      const openInNewTab = resolveOpenInNew(event);
      blurActive();
      handleMainMenuClose();
      setTimeout(() => {
        onBuild?.({ openInNewTab });
      }, 0);
    },
    [blurActive, handleMainMenuClose, resolveOpenInNew]
  );

  const handleToggleVisible = useCallback(() => {
    const onToggleVisible = propsRef.current.onToggleVisible;
    const nextVisible = !effectiveVisible;
    blurActive();
    setLocalInvisible(!nextVisible);
    setTimeout(() => {
      onToggleVisible?.(nextVisible);
    }, 0);
  }, [blurActive, effectiveVisible]);

  useEffect(() => {
    if (!anchorEl) {
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
      setCreateSubmenuOpen(false);
      setCreateSubmenuAnchor(null);
      setCreateSubmenuItems([]);
      setOpenStepMenuOpen(false);
      setOpenStepMenuAnchor(null);
    }
  }, [anchorEl]);

  const safeAnchorEl = useMemo(() => {
    try {
      if (!anchorEl) return null;
      const doc = anchorEl.ownerDocument || document;
      return doc.contains(anchorEl) ? anchorEl : null;
    } catch (error) {
      logNodeContextMenuWarning('Failed to validate context menu anchor', error);
      return null;
    }
  }, [anchorEl]);

  const hasAnchorPosition = Boolean(anchorPosition);
  const anchorReference: 'anchorEl' | 'anchorPosition' = hasAnchorPosition
    ? 'anchorPosition'
    : 'anchorEl';
  const resolvedAnchorPosition = hasAnchorPosition ? (anchorPosition ?? null) : null;
  const anchorForMenu = anchorReference === 'anchorEl' ? safeAnchorEl : null;

  useEffect(() => {
    if (anchorReference === 'anchorEl' && open && !anchorForMenu) {
      requestAnimationFrame(() => onClose());
    }
  }, [anchorReference, open, anchorForMenu, onClose]);

  const isFolder = isFolderNodeType(nodeType);
  const hasOpenSteps = Boolean(props.onOpenStep && (openSteps.length > 0 || openStepsLoading));
  const showImport = isFolder && Boolean(props.onImport) && canImport;
  const showExport = isFolder && Boolean(props.onExport) && canExport;

  const builtCreateItems = buildCreateMenuItems(props.createItems, treeId);

  return {
    addMenuOpen,
    addMenuAnchor,
    createSubmenuOpen,
    createSubmenuAnchor,
    createSubmenuItems,
    openStepMenuOpen,
    openStepMenuAnchor,
    isShiftPressed,
    language,
    createLabel,
    openFolderLabel,
    openLabel,
    editLabel,
    copyLabel,
    cutLabel,
    duplicateLabel,
    moveToArchiveLabel,
    importLabel,
    exportLabel,
    allowArchive,
    visibleLabel,
    hiddenLabel,
    previewLabel,
    buildLabel,
    effectiveVisible,
    effectiveInvisible,
    canPreview,
    showBuildEntry,
    buildDisabled,
    anchorReference,
    resolvedAnchorPosition,
    anchorForMenu,
    isFolder,
    hasOpenSteps,
    showImport,
    showExport,
    builtCreateItems,
    translateWithFallback,
    resolveIcon,
    handleAddMenuClick,
    openCreateSubmenu,
    handleOpenStepMenuClick,
    handleMainMenuClose,
    handleOpenClick,
    handleOpenStepClick,
    handleOpenFolderClick,
    handleEditClick,
    handleCreateClick,
    handleDuplicateClick,
    handleArchiveClick,
    handleCopyClick,
    handleCutClick,
    handleImportClick,
    handleExportClick,
    handlePreviewClick,
    handleBuildClick,
    handleToggleVisible,
    handleCreateSubmenuClose,
  };
}
