/**
 * TreeConsoleContent - TreeTableCore
 * TanStack Table + Virtual
 * eria-cartographTreeTableCore
 */

import { TreeTableCore } from '@hierarchidb/ui-treeconsole-treetable';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type React from 'react';
import { memo } from 'react';
import { useTreeConsoleContent } from '~/hooks/useTreeConsoleContent';
import type { TreeConsoleContentProps } from '~/types/index';

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
    useArchiveColumns,
    depthOffset: _depthOffset,
    rootNodeId: _treeRootNodeId,
    currentNodeInfo: _currentNodeInfo,
    onDragStateChange: _onDragStateChange,
    canPreviewNode: _canPreviewNode = false,
    mode: _mode,
    hideDragHandler = false,
  }) => {
    const {
      contentState,
      emptyMessage,
      loadingLabel,
      treeTableController,
      handleDragStateChange,
      shouldRenderDebugInfo,
    } = useTreeConsoleContent({
      controller,
      isProjectsPage,
      isResourcesPage,
      viewHeight,
      viewWidth,
      useArchiveColumns,
      depthOffset: _depthOffset,
      rootNodeId: _treeRootNodeId,
      currentNodeInfo: _currentNodeInfo,
      onDragStateChange: _onDragStateChange,
      canPreviewNode: _canPreviewNode,
      mode: _mode,
      hideDragHandler,
    });

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
              <Typography sx={{ ml: 2 }}>{loadingLabel}</Typography>
            </LoadingContainer>
          )}

          {contentState === 'empty' && (
            <EmptyStateContainer>
              <Typography variant="h6" color="text.secondary">
                {emptyMessage}
              </Typography>
            </EmptyStateContainer>
          )}

          {contentState === 'table' && treeTableController && (
            <TableContainer>
              <TreeTableCore
                controller={treeTableController}
                viewHeight={viewHeight}
                viewWidth={viewWidth || 800}
                useArchiveColumns={useArchiveColumns}
                depthOffset={_depthOffset}
                disableDragAndDrop={false}
                hideDragHandler={hideDragHandler}
                onDragStateChange={handleDragStateChange}
              />
            </TableContainer>
          )}

          {/* Lightweight debug info for tests/diagnostics (ensure single instance per document) */}
          {shouldRenderDebugInfo ? (
            <Box sx={{ p: 1 }} data-testid="treeconsole-debug-info">
              <Typography variant="caption">
                TreeTypes Root: {String(_treeRootNodeId || '')}
              </Typography>
              {_mode && (
                <Typography variant="caption" sx={{ ml: 2 }}>
                  Mode: {_mode}
                </Typography>
              )}
              <Typography variant="caption" sx={{ ml: 2 }}>
                Controller: {controller ? 'Available' : 'Unavailable'}
              </Typography>
            </Box>
          ) : null}
        </StableContentContainer>
      </StyledDialogContent>
    );
  }
);

TreeConsoleContent.displayName = 'TreeConsoleContent';
