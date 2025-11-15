import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { Button, Divider, Paper, Stack, Tooltip, Typography, Alert, Box } from '@mui/material';
import { Edit as EditIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import {
  NodeContextMenu,
  NodeTypeIcon,
  getPluginIconColor,
  isFolderNodeType,
} from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import type { TreeId, TreeNode } from '@hierarchidb/common-types';
import {
  type TreeConsolePanelProps,
  type TreeNodeData,
} from '@hierarchidb/ui-treeconsole-base';
import { useTranslation } from 'react-i18next';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverter.js';
import { rainbowColors } from '@hierarchidb/ui-theme';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

export interface TreeNodeInfoPanelProps {
  readonly treeId?: TreeId;
  readonly node?: TreeNode;
  readonly onContextMenuAction: ContextMenuHandler;
}

export function TreeNodeInfoPanel({ treeId, node, onContextMenuAction }: TreeNodeInfoPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.resolvedLanguage ?? i18n?.language ?? 'en';
  const nodeData = useMemo(() => (node ? convertTreeNodeToTreeNodeData(node) : undefined), [node]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuNode, setMenuNode] = useState<TreeNodeData | null>(nodeData ?? null);

  useEffect(() => {
    setMenuNode(nodeData ?? null);
    setMenuAnchorEl(null);
  }, [nodeData]);

  const getString = useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) => {
      const result = t(key, { defaultValue, ...(options ?? {}) });
      if (typeof result === 'string') return result;
      if (result == null) return defaultValue;
      return String(result);
    },
    [t]
  );

  const formatTimestamp = useCallback(
    (value?: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return getString('treeConsole.infoPanel.noTimestamp', '—');
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return getString('treeConsole.infoPanel.noTimestamp', '—');
      }
      const formatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: locale?.startsWith('ja') ? 'numeric' : 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: locale?.startsWith('ja') ? false : undefined,
      });
      return formatter.format(date);
    },
    [getString, locale]
  );

  const handleContextMenuTrigger = useCallback(
    (action: string, options?: Parameters<ContextMenuHandler>[2]) => {
      if (!nodeData) return;
      onContextMenuAction(action, nodeData, options ?? { navigateToParent: false });
    },
    [nodeData, onContextMenuAction]
  );

  const handleIconClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!nodeData) return;
      setMenuNode(nodeData);
      setMenuAnchorEl(event.currentTarget);
    },
    [nodeData]
  );

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  if (!node) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="info">
          {getString(
            'treeConsole.infoPanel.noNode',
            'Node information is not available for this page.'
          )}
        </Alert>
      </Box>
    );
  }

  const createdAtLabel = formatTimestamp(node.createdAt);
  const updatedAtLabel = formatTimestamp(node.updatedAt);
  const description =
    (node.description && node.description.trim().length > 0
      ? node.description
      : getString('treeConsole.infoPanel.emptyDescription', 'No description provided.')) ?? '';
  const nodeTypeLabel = node.nodeType ?? 'node';
  const isRootLike =
    !node.parentId ||
    !nodeData ||
    nodeData.depth === 0 ||
    /root/i.test(node.nodeType ?? '') ||
    /trash/i.test(node.nodeType ?? '');

  const canMutate = !isRootLike;
  const iconTooltip = getString('treeConsole.infoPanel.openContextMenu', 'Node actions');
  const nodeTypeCaption = getString('treeConsole.infoPanel.nodeTypeLabel', '{{type}}', {
    type: nodeTypeLabel,
  });
  const editLabel = getString('treeConsole.infoPanel.editLabel', 'Edit');
  const editAria = getString('treeConsole.infoPanel.editButton', 'Edit node');
  const previewLabel = getString('treeConsole.infoPanel.previewLabel', 'Play');
  const previewAria = getString('treeConsole.infoPanel.previewButton', 'Preview node');
  const unnamedNodeLabel = getString('treeConsole.infoPanel.unnamedNode', 'Untitled node');
  const depthForColor = (() => {
    const depthCandidate = nodeData?.depth ?? node?.depth;
    if (typeof depthCandidate === 'number' && Number.isFinite(depthCandidate)) {
      return Math.max(0, Math.round(depthCandidate));
    }
    return 0;
  })();
  const baseIconColor = rainbowColors[depthForColor % rainbowColors.length];
  const manifestIconColor = getPluginIconColor(nodeTypeLabel);
  const nodeIconColor = isFolderNodeType(nodeTypeLabel)
    ? baseIconColor
    : manifestIconColor ?? baseIconColor;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Paper
        elevation={2}
        sx={{
          width: '100%',
          maxWidth: 640,
          p: { xs: 3, md: 4 },
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Tooltip title={iconTooltip}>
          <span style={{ display: 'inline-flex', justifyContent: 'center' }}>
            <NodeTypeIcon
              nodeType={nodeTypeLabel}
              size="large"
              clickable
              onClick={handleIconClick}
              color="inherit"
              htmlColor={nodeIconColor}
            />
          </span>
        </Tooltip>

        <Stack spacing={0.5} alignItems="center">
          <Typography variant="h4" component="h2" sx={{ wordBreak: 'break-word' }}>
            {node.name || unnamedNodeLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {nodeTypeCaption}
          </Typography>
        </Stack>

        <Divider />

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
        >
          {description}
        </Typography>

        <Divider />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          alignItems="center"
        >
          <Typography variant="body2" color="text.secondary">
            {getString('treeConsole.infoPanel.createdAt', 'Created: {{value}}', {
              value: createdAtLabel,
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getString('treeConsole.infoPanel.updatedAt', 'Updated: {{value}}', {
              value: updatedAtLabel,
            })}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => handleContextMenuTrigger('edit')}
            disabled={!canMutate}
            aria-label={editAria}
          >
            {editLabel}
          </Button>
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() => handleContextMenuTrigger('preview')}
            aria-label={previewAria}
          >
            {previewLabel}
          </Button>
        </Stack>
      </Paper>

      <NodeContextMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuNode)}
        onClose={handleMenuClose}
        nodeId={menuNode?.id ?? ''}
        nodeType={menuNode?.nodeType ?? 'folder'}
        nodeName={menuNode?.name ?? ''}
        treeId={treeId}
        canCreate={false}
        canEdit={canMutate}
        canDuplicate={canMutate}
        canCopy={canMutate}
        canCut={canMutate}
        canTrash={canMutate}
        canRemove={canMutate}
        onOpen={() => handleContextMenuTrigger('navigate')}
        onOpenFolder={() => handleContextMenuTrigger('navigate')}
        onPreview={() => handleContextMenuTrigger('preview')}
        onEdit={() => handleContextMenuTrigger('edit')}
        onDuplicate={() => handleContextMenuTrigger('duplicate')}
        onCopy={() => handleContextMenuTrigger('copy')}
        onCut={() => handleContextMenuTrigger('cut')}
        onTrash={() => handleContextMenuTrigger('trash')}
        onRemove={() => handleContextMenuTrigger('trash')}
      />
    </Box>
  );
}
