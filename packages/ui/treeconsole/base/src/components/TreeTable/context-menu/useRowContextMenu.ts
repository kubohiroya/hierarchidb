import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useIconRegistry } from '@hierarchidb/components';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import type { CreateMenuBuilder, CreateMenuEntry, GlobalMenuBuilders } from '~/types/menu-types';
import type { RowContextMenuProps } from './RowContextMenu.js';

export interface LocalizedCreateMenuEntry {
  key: string;
  nodeType: string;
  icon: ReactNode;
  label: string;
  description: string;
}

export interface UseRowContextMenuResult {
  t: (key: string, fallback: string) => string;
  language: string;
  addMenuOpen: boolean;
  addMenuAnchor: HTMLElement | null;
  effectiveVisible: boolean;
  effectiveInvisible: boolean;
  isFolder: boolean;
  safeAnchorEl: HTMLElement | null;
  allowArchive: boolean;
  localizedCreateMenuEntries: LocalizedCreateMenuEntry[];
  createMenuUnavailable: boolean;
  formatCreateTooltip: (label: string, description?: string) => string;
  handleAddMenuClick: (event: MouseEvent<HTMLElement>) => void;
  handleOpenClick: () => void;
  handleMainMenuClose: () => void;
  handleCreateClick: (type: string) => void;
  handleOpenFolderClick: () => void;
  handleToggleVisible: () => void;
  handleEditClick: () => void;
  handleDuplicateClick: () => void;
  handleArchiveClick: () => void;
  handlePreviewClick: () => void;
}

function resolveSafeAnchorEl(element: HTMLElement | null): HTMLElement | null {
  try {
    if (!element) return null;
    const ownerDocument = element.ownerDocument ?? document;
    return ownerDocument.contains(element) ? element : null;
  } catch {
    return null;
  }
}

export function useRowContextMenu(props: RowContextMenuProps): UseRowContextMenuResult {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [localInvisible, setLocalInvisible] = useState<boolean | null>(null);
  const { t, language } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();
  const propsRef = useRef(props);

  const isVisible = props.isVisible;
  const effectiveVisible =
    localInvisible !== null ? !localInvisible : (typeof isVisible === 'boolean' ? isVisible : true);
  const effectiveInvisible = !effectiveVisible;

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

  const formatCreateTooltip = useCallback(
    (label: string, description?: string) => {
      if (!description || description.trim().length === 0) return label;
      const template = translateWithFallback(
        'treeConsole.contextMenu.createTooltip',
        '{{label}}: {{description}}',
      );
      return template.replace('{{label}}', label).replace('{{description}}', description);
    },
    [translateWithFallback],
  );

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!props.parentElem) {
      setLocalInvisible(null);
      return;
    }
    const resolvedVisible = typeof isVisible === 'boolean' ? isVisible : true;
    if (localInvisible !== null && localInvisible === !resolvedVisible) {
      setLocalInvisible(null);
    }
  }, [props.parentElem, isVisible, localInvisible]);

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
    propsRef.current.onClose();
  }, []);

  const handleOpenClick = useCallback(() => {
    const onOpen = propsRef.current.onOpen;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onOpen();
    });
  }, [handleMainMenuClose]);

  const handleCreateClick = useCallback(
    (type: string) => {
      const onCreate = propsRef.current.onCreate;
      handleMainMenuClose();
      requestAnimationFrame(() => {
        onCreate(type);
      });
    },
    [handleMainMenuClose],
  );

  const handleOpenFolderClick = useCallback(() => {
    const onOpenFolder = propsRef.current.onOpenFolder;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onOpenFolder();
    });
  }, [handleMainMenuClose]);

  const handleToggleVisible = useCallback(() => {
    const onToggleVisible = propsRef.current.onToggleVisible;
    const nextVisible = !effectiveVisible;
    setLocalInvisible(!nextVisible);
    requestAnimationFrame(() => {
      onToggleVisible?.(nextVisible);
    });
  }, [effectiveVisible]);

  const handleEditClick = useCallback(() => {
    const onEdit = propsRef.current.onEdit;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onEdit();
    });
  }, [handleMainMenuClose]);

  const handleDuplicateClick = useCallback(() => {
    const onDuplicate = propsRef.current.onDuplicate;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onDuplicate();
    });
  }, [handleMainMenuClose]);

  const handleArchiveClick = useCallback(() => {
    const current = propsRef.current;
    const handler = current.onArchive ?? current.onRemove;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      handler?.();
    });
  }, [handleMainMenuClose]);

  const handlePreviewClick = useCallback(() => {
    const onPreview = propsRef.current.onPreview;
    handleMainMenuClose();
    requestAnimationFrame(() => {
      onPreview();
    });
  }, [handleMainMenuClose]);

  useEffect(() => {
    if (!props.parentElem) {
      setAddMenuOpen(false);
      setAddMenuAnchor(null);
    }
  }, [props.parentElem]);

  const isFolder = props.nodeType === 'folder';
  const safeAnchorEl = useMemo(() => resolveSafeAnchorEl(props.parentElem), [props.parentElem]);

  useEffect(() => {
    if (safeAnchorEl === null && propsRef.current.parentElem && propsRef.current.onClose) {
      requestAnimationFrame(() => propsRef.current.onClose());
    }
  }, [safeAnchorEl]);

  const allowArchive = props.canArchive ?? props.canRemove ?? true;

  const { localizedCreateMenuEntries, createMenuUnavailable } = useMemo(() => {
    try {
      const globals = (globalThis as { __HDB_MENU_BUILDERS__?: GlobalMenuBuilders }).__HDB_MENU_BUILDERS__;
      const builder: CreateMenuBuilder | undefined =
        globals?.buildMenuItemsForTreeId || globals?.buildMenuItemsForContext;

      if (typeof builder !== 'function') {
        return {
          localizedCreateMenuEntries: [],
          createMenuUnavailable: true,
        };
      }

      const entries = (builder(props.treeId) as CreateMenuEntry[] | undefined) ?? [];
      return {
        localizedCreateMenuEntries: entries.map((entry) => {
          const localizedLabel = translateWithFallback(`plugins.${entry.nodeType}.name`, entry.label);
          const localizedDescription = translateWithFallback(
            `plugins.${entry.nodeType}.description`,
            entry.description ?? '',
          ).trim();

          return {
            key: entry.key,
            nodeType: entry.nodeType,
            icon: resolveIcon({ nodeType: entry.nodeType, icon: entry.icon }),
            label: localizedLabel,
            description: localizedDescription,
          } satisfies LocalizedCreateMenuEntry;
        }),
        createMenuUnavailable: false,
      };
    } catch {
      return {
        localizedCreateMenuEntries: [],
        createMenuUnavailable: true,
      };
    }
  }, [props.treeId, resolveIcon, translateWithFallback]);

  return {
    t,
    language,
    addMenuOpen,
    addMenuAnchor,
    effectiveVisible,
    effectiveInvisible,
    isFolder,
    safeAnchorEl,
    allowArchive,
    localizedCreateMenuEntries,
    createMenuUnavailable,
    formatCreateTooltip,
    handleAddMenuClick,
    handleOpenClick,
    handleMainMenuClose,
    handleCreateClick,
    handleOpenFolderClick,
    handleToggleVisible,
    handleEditClick,
    handleDuplicateClick,
    handleArchiveClick,
    handlePreviewClick,
  };
}
