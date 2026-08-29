/**
 * TreeTableContextMenu
 * Wraps the TreeTable node context menu interactions with controller actions.
 */

import type { NodeId } from '@hierarchidb/core-types';
import { getTreeNodeName } from '@hierarchidb/tree-api';
import { type NodeContextMenuProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { type ComponentType } from 'react';
import type { BuildSessionIndicator, TreeTableController } from '~/types';
import {
  type TreeTableContextMenuState,
  useTreeTableContextMenu,
} from './useTreeTableContextMenu.js';

interface TreeTableContextMenuProps {
  contextMenuState: TreeTableContextMenuState;
  onClose: () => void;
  treeId?: string;
  controller?: TreeTableController;
  buildSessionIndicator?: BuildSessionIndicator;
  collectDescendantIds?: (nodeId: NodeId) => string[];
  ContextMenuComponent: ComponentType<NodeContextMenuProps>;
}

export function TreeTableContextMenu({
  contextMenuState,
  onClose,
  treeId,
  controller,
  buildSessionIndicator,
  collectDescendantIds,
  ContextMenuComponent,
}: TreeTableContextMenuProps) {
  const {
    node,
    open,
    isRoot,
    isBuildRequiredForNode,
    canArchive,
    canBuild,
    buildAvailabilitySummary,
    buildAvailabilityTooltip,
    buildDiagnosticsLabel,
    canCreate,
    canImportExport,
    canPreview,
    openSteps,
    openStepsLoading,
    commandActions,
    handleClose,
    onToggleVisible,
    onCreate,
    onEdit,
    onDuplicate,
    onArchive,
    onRemove,
    onCopy,
    onCut,
    onImport,
    onExport,
    onOpen,
    onOpenFolder,
    onOpenStep,
    onPreview,
    onBuild,
    onBuildDiagnostics,
    onCommandAction,
  } = useTreeTableContextMenu({
    contextMenuState,
    onClose,
    controller,
    buildSessionIndicator,
    collectDescendantIds,
  });

  return (
    <ContextMenuComponent
      anchorEl={contextMenuState.anchorEl}
      anchorPosition={contextMenuState.anchorPosition}
      open={open}
      onClose={handleClose}
      nodeId={node?.id || ''}
      nodeType={node?.nodeType || 'folder'}
      treeId={treeId}
      nodeName={node ? getTreeNodeName(node) : ''}
      isVisible={node?.visible ?? true}
      buildRequired={isBuildRequiredForNode}
      canBuild={canBuild}
      buildAvailabilitySummary={buildAvailabilitySummary}
      buildAvailabilityTooltip={buildAvailabilityTooltip}
      buildDiagnosticsLabel={buildDiagnosticsLabel}
      canCreate={canCreate}
      canEdit={!isRoot}
      canRemove={canArchive}
      canArchive={canArchive}
      canDuplicate={!isRoot}
      canCopy={!isRoot}
      canCut={!isRoot}
      canImport={canImportExport}
      canExport={canImportExport}
      canPreview={canPreview}
      onToggleVisible={onToggleVisible}
      onCreate={onCreate}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onArchive={onArchive}
      onRemove={onRemove}
      onCopy={onCopy}
      onCut={onCut}
      onImport={onImport}
      onExport={onExport}
      onOpen={onOpen}
      onOpenFolder={onOpenFolder}
      onOpenStep={onOpenStep}
      openSteps={openSteps}
      openStepsLoading={openStepsLoading}
      commandActions={commandActions}
      onCommandAction={onCommandAction}
      onPreview={onPreview}
      onBuild={onBuild}
      onBuildDiagnostics={onBuildDiagnostics}
    />
  );
}
