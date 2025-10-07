/**
  * TreeConsoleContent - TreeTableCore
   * TanStack Table + Virtual
  * eria-cartographTreeTableCore
  */

import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { TreeConsoleContentProps } from '../types/index.js';
import type { NodeId } from '@hierarchidb/common-types';
import { TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { TreeNode } from '@hierarchidb/common-types';

const StyledDialogContent = styled(Box)`
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  overflow: hidden;
`;

const LoadingContainer = styled(Box)`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`;

const EmptyStateContainer = styled(Box)`
  text-align: center;
  margin-top: 20px;
`;

const TableContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

const StableContentContainer = styled(Box)`
  height: 100%;
  width: 100%;
  transition: opacity 0.2s ease-in-out;
`;

/**
  * TreeConsoleContent
 * TreeTableCore
  */
export const TreeConsoleContent: React.FC<TreeConsoleContentProps> = memo(
  ({
     controller,
     isProjectsPage,
     isResourcesPage,
     viewHeight,
     viewWidth,
     useTrashColumns,
     depthOffset: _depthOffset,
     rootNodeId: _treeRootNodeId,
     currentNodeInfo: _currentNodeInfo,
     onDragStateChange: _onDragStateChange,
     canPreviewNode: _canPreviewNode = false,
     mode: _mode,
     hideDragHandler = false,
   }) => {
    const [isWebKit, setIsWebKit] = useState(false);
    const [webKitInitialized, setWebKitInitialized] = useState(false);

    //  WebKit Safari
    useEffect(() => {
      if (typeof window !== 'undefined') {
        const ua = window.navigator.userAgent.toLowerCase();
        const isWebKitBrowser =
          ua.includes('webkit') && !ua.includes('chrome') && !ua.includes('firefox');
        setIsWebKit(isWebKitBrowser);

        if (isWebKitBrowser) {
          const timer = setTimeout(() => {
            setWebKitInitialized(true);
          }, 500);
          return () => clearTimeout(timer);
        } else {
          setWebKitInitialized(true);
        }
      } else {
        setWebKitInitialized(true);
      }
    }, []);

    const globalProcess = (globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }).process;
    const isTestEnv = globalProcess?.env?.NODE_ENV === 'test';
    const isLoading = !controller || controller.isLoading || (!isTestEnv && isWebKit && !webKitInitialized);

    const hasMinimumData =
      controller && controller.selectedNodes && Array.isArray(controller.selectedNodes);

    const isEmpty = controller && !controller.isLoading && controller.selectedNodes.length === 0;

    const contentState = (() => {
      if (isLoading) return 'loading';
      if (isEmpty) return 'empty';
      if (hasMinimumData) return 'table';
      return 'loading';
    })();

    const getEmptyMessage = () => {
      if (_mode === 'restore') {
        return 'ゴミ箱に復元可能なアイテムはありません。';
      }
      if (_mode === 'dispose') {
        return '完全削除可能なアイテムはありません。';
      }
      if (isProjectsPage) {
        return 'プロジェクトがありません。新しいプロジェクトを作成してください。';
      }
      if (isResourcesPage) {
        return 'リソースがありません。新しいリソースを作成してください。';
      }
      return 'データがありません。';
    };

  return (
      <StyledDialogContent
        sx={{
          height: viewHeight || '100%',
          width: viewWidth || '100%',
        }}
      >
        <StableContentContainer>
          {contentState === 'loading' && (
            <LoadingContainer>
              <CircularProgress size={40} />
              <Typography sx={{ ml: 2 }}>読み込み中...</Typography>
            </LoadingContainer>
          )}

          {contentState === 'empty' && (
            <EmptyStateContainer>
              <Typography variant="h6" color="text.secondary">
                {getEmptyMessage()}
              </Typography>
            </EmptyStateContainer>
          )}

          {contentState === 'table' && controller && (
            <TableContainer>
              <TreeTableCore
                controller={{
                  data: controller.data,
                  rowSelection: controller.rowSelection,
                  expandedRowIds: controller.expandedRowIds,
                  rootNodeId: controller.rootNodeId,
                  searchText: controller.searchText,
                  filteredItemCount: controller.filteredItemCount,
                  totalItemCount: controller.totalItemCount,
                  handleSearchTextChange: controller.handleSearchTextChange,
                  onNodeClick: controller.onNodeClick ?
                    (nodeId: string, node?: TreeNodeInUI) => controller.onNodeClick!(nodeId as NodeId, node as unknown as TreeNode) :
                    undefined,
                  onNodeExpand: controller.onNodeExpand ?
                    (nodeId: string, expanded: boolean) =>
                      controller.onNodeExpand!(nodeId as NodeId, expanded) :
                    undefined,
                  onNodeSelect: controller.onNodeSelect ?
                    (nodeIds: string[], selected: boolean) =>
                      controller.onNodeSelect!(nodeIds as NodeId[], selected) :
                    undefined,
                  startEdit: controller.startEdit ?
                    (nodeId: string) => controller.startEdit!(nodeId as NodeId) :
                    undefined,
                  finishEdit: controller.finishEdit ?
                    (nodeId: string, newName: string, field?: 'name' | 'description') =>
                      controller.finishEdit!(nodeId as NodeId, newName, field) :
                    undefined,
                  cancelEdit: controller.cancelEdit,
                  onCreate: controller.onCreate ?
                    (parentId: string, type: string) =>
                      controller.onCreate!(parentId as NodeId, type) :
                    undefined,
                  onDuplicate: controller.onDuplicate ?
                    (nodeId: string) =>
                      controller.onDuplicate!(nodeId as NodeId) :
                    undefined,
                  onRemove: controller.onRemove ?
                    (nodeIds: string[]) => controller.onRemove!(nodeIds as NodeId[]) :
                    undefined,
                }}
                viewHeight={viewHeight || 400}
                viewWidth={viewWidth || 800}
                useTrashColumns={useTrashColumns}
                depthOffset={_depthOffset}
                disableDragAndDrop={false}
                hideDragHandler={hideDragHandler}
                onDragStateChange={_onDragStateChange ?
                  (draggingNodeId: NodeId | undefined, descendantIdSet: Set<NodeId> | undefined, _dragPreviewElement: HTMLElement | null) =>
                    _onDragStateChange(draggingNodeId, descendantIdSet) :
                  undefined}
              />
            </TableContainer>
          )}

          {/* Lightweight debug info for tests/diagnostics (ensure single instance per document) */}
          {typeof document === 'undefined' || !document.querySelector('[data-testid="treeconsole-debug-info"]') ? (
            <Box sx={{ p: 1 }} data-testid="treeconsole-debug-info">
              <Typography variant="caption">TreeTypes Root: {String(_treeRootNodeId || '')}</Typography>
              {_mode && (
                <Typography variant="caption" sx={{ ml: 2 }}>Mode: {_mode}</Typography>
              )}
              <Typography variant="caption" sx={{ ml: 2 }}>
                Controller: {controller ? 'Available' : 'Unavailable'}
              </Typography>
            </Box>
          ) : null}
        </StableContentContainer>
      </StyledDialogContent>
    );
  },
);

TreeConsoleContent.displayName = 'TreeConsoleContent';
