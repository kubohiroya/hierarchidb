import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ComponentType, Dispatch, KeyboardEvent, MouseEvent, SetStateAction } from 'react';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-i18n';
import type { BreadcrumbNode, TreeConsoleBreadcrumbProps } from '../types.js';
import { NodeContextMenu, type OpenStepOption } from '../components/NodeContextMenu.js';
import { NodeTypeIcon } from '../components/NodeTypeIcon.js';

interface UseTreeConsoleBreadcrumbResult {
  pathToUse: BreadcrumbNode[];
  iconInteractive: boolean;
  IconComponent: ComponentType<ComponentProps<typeof NodeTypeIcon>>;
  ContextMenuComponent: ComponentType<ComponentProps<typeof NodeContextMenu>>;
  blockedDescendantMoveLabel: string;
  handleNodeClick: (nodeId: string, node?: BreadcrumbNode) => void;
  handleContextMenuOpen: (
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    node: BreadcrumbNode
  ) => void;
  handleContextMenuClose: () => void;
  openContextMenu: (node: BreadcrumbNode, anchorEl: HTMLElement | null) => void;
  contextMenuAnchor: HTMLElement | null;
  contextMenuNode: BreadcrumbNode | null;
  openSteps: OpenStepOption[];
  openStepsLoading: boolean;
  confirmDialogOpen: boolean;
  setConfirmDialogOpen: Dispatch<SetStateAction<boolean>>;
  handleConfirmArchive: () => void;
  handleCreate: (type: string) => void;
  handleEdit: () => void;
  handleDuplicate: () => void;
  handleCopy: () => void;
  handleCut: () => void;
  handleImport: () => void;
  handleExport: () => void;
  handleBuild: () => void;
  handleArchive: () => void;
  isRootContext: boolean;
  isNavigating: boolean;
  hoverId: string | null;
  setHoverId: Dispatch<SetStateAction<string | null>>;
  hoverBlocked: boolean;
  setHoverBlocked: Dispatch<SetStateAction<boolean>>;
  useArchiveColumnsFlag: boolean;
  trashActionValue: 'restore' | 'empty' | undefined;
}

export const useTreeConsoleBreadcrumb = (
  props: TreeConsoleBreadcrumbProps
): UseTreeConsoleBreadcrumbResult => {
  const {
    nodePath = [],
    onNodeClick,
    context = {},
    NodeTypeIcon: CustomNodeTypeIcon,
    NodeContextMenu: CustomNodeContextMenu,
    onContextAction,
  } = props;

  const { isProjectsPage } = context;
  const useArchiveColumnsFlag: boolean = Boolean(props.useArchiveColumns);
  const trashActionValue: 'restore' | 'empty' | undefined = props.trashAction;
  const iconInteractive = props.iconInteractive ?? true;

  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<BreadcrumbNode | null>(null);
  const [openSteps, setOpenSteps] = useState<OpenStepOption[]>([]);
  const [openStepsLoading, setOpenStepsLoading] = useState(false);

  const { t } = useGlobalI18nTranslator();
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
  const blockedDescendantMoveLabel = translateWithFallback(
    'treeConsole.breadcrumb.blockedDescendantMove',
    'Cannot move to a descendant.'
  );

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<BreadcrumbNode | null>(null);

  const [isNavigating] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverBlocked, setHoverBlocked] = useState<boolean>(false);

  const pathToUse = useMemo(() => {
    if (nodePath && nodePath.length > 0) {
      return [...nodePath];
    }

    const rootNodeName = isProjectsPage ? 'Projects' : 'Resources';
    return [
      {
        id: isProjectsPage ? 'projects-root' : 'resources-root',
        nodeType: isProjectsPage ? 'ProjectsRoot' : 'ResourcesRoot',
        name: rootNodeName,
        parentId: null,
      },
    ];
  }, [nodePath, isProjectsPage]);

  const handleNodeClick = useCallback(
    (nodeId: string, node?: BreadcrumbNode) => {
      if (onNodeClick) {
        onNodeClick(nodeId, node);
      } else if (onContextAction && node) {
        onContextAction('navigate', node);
      }
    },
    [onContextAction, onNodeClick]
  );

  const handleConfirmArchive = useCallback(() => {
    if (pendingDeleteNodeId && pendingDeleteNode && onContextAction) {
      onContextAction('trash', pendingDeleteNode, { navigateToParent: true, source: 'breadcrumb' });
    }
    setConfirmDialogOpen(false);
    setPendingDeleteNodeId(null);
    setPendingDeleteNode(null);
  }, [onContextAction, pendingDeleteNode, pendingDeleteNodeId]);

  const openContextMenu = useCallback((node: BreadcrumbNode, anchorEl: HTMLElement | null) => {
    if (!anchorEl) return;
    setContextMenuAnchor(anchorEl);
    setContextMenuNode(node);
  }, []);

  const handleContextMenuOpen = useCallback(
    (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, node: BreadcrumbNode) => {
      event.preventDefault();
      event.stopPropagation();

      const anchorEl = event.currentTarget as unknown as HTMLElement | null;
      openContextMenu(node, anchorEl);
    },
    [openContextMenu]
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenuAnchor(null);
    setContextMenuNode(null);
    setOpenSteps([]);
  }, []);

  useEffect(() => {
    const resolver = props.resolveOpenSteps;
    const node = contextMenuNode;
    if (!resolver || !contextMenuAnchor || !node) {
      setOpenSteps([]);
      setOpenStepsLoading(false);
      return;
    }
    const nodeId = node.id ?? node.treeNodeId;
    const nodeType = node.nodeType;
    if (!nodeId || !nodeType) {
      setOpenSteps([]);
      return;
    }
    let cancelled = false;
    setOpenStepsLoading(true);
    void (async () => {
      const steps = await resolver(String(nodeId), String(nodeType));
      if (!cancelled) {
        setOpenSteps(Array.isArray(steps) ? steps : []);
        setOpenStepsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contextMenuAnchor, contextMenuNode, props.resolveOpenSteps]);

  const handleCreate = useCallback(
    (type: string) => {
      if (contextMenuNode && onContextAction) {
        onContextAction(`create:${type}`, contextMenuNode, {
          navigateToParent: true,
          source: 'breadcrumb',
        });
      }
    },
    [contextMenuNode, onContextAction]
  );

  const handleEdit = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('edit', contextMenuNode, { source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleDuplicate = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('duplicate', contextMenuNode, { source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleCopy = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('copy', contextMenuNode, { source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleCut = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('cut', contextMenuNode, { navigateToParent: true, source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleImport = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('import', contextMenuNode, { source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleExport = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('export', contextMenuNode, { source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleBuild = useCallback(() => {
    if (contextMenuNode && onContextAction) {
      onContextAction('build', contextMenuNode, { source: 'breadcrumb' });
    }
  }, [contextMenuNode, onContextAction]);

  const handleArchive = useCallback(() => {
    if (contextMenuNode) {
      setPendingDeleteNodeId(contextMenuNode.id || contextMenuNode.id || '');
      setPendingDeleteNode(contextMenuNode);
      setConfirmDialogOpen(true);
    }
  }, [contextMenuNode]);

  const isRootContext = useMemo(() => {
    if (!contextMenuNode) return false;
    const first = pathToUse[0];
    return !!first && String(first.id) === String(contextMenuNode.id || contextMenuNode.id);
  }, [contextMenuNode, pathToUse]);

  return {
    pathToUse,
    iconInteractive,
    IconComponent,
    ContextMenuComponent,
    blockedDescendantMoveLabel,
    handleNodeClick,
    handleContextMenuOpen,
    handleContextMenuClose,
    openContextMenu,
    contextMenuAnchor,
    contextMenuNode,
    openSteps,
    openStepsLoading,
    confirmDialogOpen,
    setConfirmDialogOpen,
    handleConfirmArchive,
    handleCreate,
    handleEdit,
    handleDuplicate,
    handleCopy,
    handleCut,
    handleImport,
    handleExport,
    handleBuild,
    handleArchive,
    isRootContext,
    isNavigating,
    hoverId,
    setHoverId,
    hoverBlocked,
    setHoverBlocked,
    useArchiveColumnsFlag,
    trashActionValue,
  };
};
