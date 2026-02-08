import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';

interface TreeConsoleNodeContextMenuProps {
  anchorEl: HTMLElement | null;
  anchorPosition?: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  nodeType?: string;
  canRemove?: boolean;
  canTrash?: boolean;
  isVisible?: boolean;
  onOpen?: () => void;
  onOpenFolder?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onCreate?: (type: string) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onTrash?: () => void;
  onToggleVisible?: (nextValue: boolean) => void;
}

interface NodeContextMenuLabels {
  create: string;
  openFolder: string;
  open: string;
  edit: string;
  duplicate: string;
  moveToTrash: string;
  visible: string;
  hidden: string;
  preview: string;
  createFolder: string;
  createNote: string;
  createFile: string;
}

interface UseTreeConsoleNodeContextMenuResult {
  addMenuOpen: boolean;
  addMenuAnchor: HTMLElement | null;
  isFolder: boolean;
  allowTrash: boolean;
  safeAnchorEl: HTMLElement | null;
  fallbackAnchorPosition: { top: number; left: number } | null;
  effectiveVisible: boolean;
  effectiveInvisible: boolean;
  labels: NodeContextMenuLabels;
  handleAddMenuClick: (event: MouseEvent<HTMLElement>) => void;
  handleMainMenuClose: () => void;
  handleOpenClick: () => void;
  handleOpenFolderClick: () => void;
  handleEditClick: () => void;
  handleCreateClick: (type: string) => void;
  handleDuplicateClick: () => void;
  handleTrashClick: () => void;
  handlePreviewClick: () => void;
  handleToggleVisible: () => void;
  setLocalInvisible: Dispatch<SetStateAction<boolean | null>>;
  setAddMenuOpen: Dispatch<SetStateAction<boolean>>;
  setAddMenuAnchor: Dispatch<SetStateAction<HTMLElement | null>>;
}

const buildTranslator = (t: (key: string, fallback: string) => string) => {
  return (key: string, fallback: string) => {
    const safeFallback = fallback?.trim?.() ?? '';
    const translated = t(key, safeFallback);
    if (translated === key) {
      return safeFallback || key;
    }
    return translated;
  };
};

export const useTreeConsoleNodeContextMenu = (
  props: TreeConsoleNodeContextMenuProps
): UseTreeConsoleNodeContextMenuResult => {
  const {
    anchorEl,
    anchorPosition,
    open,
    onClose,
    nodeType = 'folder',
    canRemove,
    canTrash,
    isVisible,
  } = props;

  const { t } = useGlobalI18nTranslator();
  const translateWithFallback = useMemo(() => buildTranslator(t), [t]);

  const labels = useMemo<NodeContextMenuLabels>(
    () => ({
      create: translateWithFallback('treeConsole.contextMenu.create', 'Create'),
      openFolder: translateWithFallback('treeConsole.contextMenu.openFolder', 'Open folder'),
      open: translateWithFallback('treeConsole.contextMenu.open', 'Open'),
      edit: translateWithFallback('treeConsole.contextMenu.edit', 'Edit'),
      duplicate: translateWithFallback('treeConsole.contextMenu.duplicate', 'Duplicate'),
      moveToTrash: translateWithFallback('treeConsole.contextMenu.moveToTrash', 'Move to Trash'),
      visible: translateWithFallback('treeConsole.contextMenu.visible', 'Visible'),
      hidden: translateWithFallback('treeConsole.contextMenu.hidden', 'Hidden'),
      preview: translateWithFallback('treeConsole.contextMenu.preview', 'Preview'),
      createFolder: translateWithFallback('treeConsole.contextMenu.createFolder', 'Folder'),
      createNote: translateWithFallback('treeConsole.contextMenu.createNote', 'Note'),
      createFile: translateWithFallback('treeConsole.contextMenu.createFile', 'File'),
    }),
    [translateWithFallback]
  );

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [localInvisible, setLocalInvisible] = useState<boolean | null>(null);

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

  const handleAddMenuClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const menuItem = event.currentTarget.closest('li');
    if (menuItem) {
      setAddMenuAnchor(menuItem as HTMLElement);
      setAddMenuOpen(true);
    }
  }, []);

  const handleMainMenuClose = useCallback(() => {
    setAddMenuOpen(false);
    setAddMenuAnchor(null);
    onClose();
  }, [onClose]);

  const handleOpenClick = useCallback(() => {
    const onOpen = propsRef.current.onOpen;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onOpen?.();
    });
  }, [handleMainMenuClose]);

  const handleOpenFolderClick = useCallback(() => {
    const onOpenFolder = propsRef.current.onOpenFolder;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onOpenFolder?.();
    });
  }, [handleMainMenuClose]);

  const handleEditClick = useCallback(() => {
    const onEdit = propsRef.current.onEdit;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onEdit?.();
    });
  }, [handleMainMenuClose]);

  const handleCreateClick = useCallback(
    (type: string) => {
      const onCreate = propsRef.current.onCreate;
      handleMainMenuClose();
      requestAnimationFrame(() => {
        onCreate?.(type);
      });
    },
    [handleMainMenuClose]
  );

  const handleDuplicateClick = useCallback(() => {
    const onDuplicate = propsRef.current.onDuplicate;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onDuplicate?.();
    });
  }, [handleMainMenuClose]);

  const handleTrashClick = useCallback(() => {
    const current = propsRef.current;
    const handler = current.onTrash ?? current.onRemove;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      handler?.();
    });
  }, [handleMainMenuClose]);

  const handlePreviewClick = useCallback(() => {
    const onPreview = propsRef.current.onPreview;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onPreview?.();
    });
  }, [handleMainMenuClose]);

  const handleToggleVisible = useCallback(() => {
    const onToggleVisible = propsRef.current.onToggleVisible;
    const effectiveVisible =
      localInvisible !== null
        ? !localInvisible
        : (typeof isVisible === 'boolean' ? isVisible : true);
    const nextVisible = !effectiveVisible;
    setLocalInvisible(!nextVisible);
    requestAnimationFrame(() => {
      onToggleVisible?.(nextVisible);
    });
  }, [isVisible, localInvisible]);

  useEffect(() => {
    if (!anchorEl) {
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
    }
  }, [anchorEl]);

  const isFolder = nodeType === 'folder' || nodeType === 'ProjectFolder' || nodeType === 'ResourceFolder';
  const allowTrash = (typeof canTrash === 'boolean' ? canTrash : undefined) ?? canRemove ?? true;

  const safeAnchorEl = useMemo(() => {
    try {
      if (!anchorEl) return null;
      const doc = anchorEl.ownerDocument || document;
      return doc.contains(anchorEl) ? anchorEl : null;
    } catch (error) {
      console.warn('[NodeContextMenu] Failed to validate context menu anchor', error);
      return null;
    }
  }, [anchorEl]);

  const fallbackAnchorPosition = !safeAnchorEl && anchorPosition ? anchorPosition : null;

  useEffect(() => {
    if (open && !safeAnchorEl && !fallbackAnchorPosition) {
      requestAnimationFrame(() => handleMainMenuClose());
    }
  }, [open, safeAnchorEl, fallbackAnchorPosition, handleMainMenuClose]);

  const effectiveVisible =
    localInvisible !== null
      ? !localInvisible
      : (typeof isVisible === 'boolean' ? isVisible : true);
  const effectiveInvisible = !effectiveVisible;

  return {
    addMenuOpen,
    addMenuAnchor,
    isFolder,
    allowTrash,
    safeAnchorEl,
    fallbackAnchorPosition,
    effectiveVisible,
    effectiveInvisible,
    labels,
    handleAddMenuClick,
    handleMainMenuClose,
    handleOpenClick,
    handleOpenFolderClick,
    handleEditClick,
    handleCreateClick,
    handleDuplicateClick,
    handleTrashClick,
    handlePreviewClick,
    handleToggleVisible,
    setLocalInvisible,
    setAddMenuOpen,
    setAddMenuAnchor,
  };
};
