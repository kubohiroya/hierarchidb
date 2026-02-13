import { Box, Button, Typography } from '@mui/material';
import type { TreeConsoleHeaderProps } from '../types/index.js';

/**
  * TreeConsoleHeader
    */
export function TreeConsoleHeader(props: TreeConsoleHeaderProps): React.JSX.Element {
  const {
    title,
    baseTitle: _baseTitle,
    baseTitleSingular: _baseTitleSingular,
    isShowingBranch: _isShowingBranch,
    isRootNode: _isRootNode,
    currentNodeInfo,
    controller: _controller,
    previousNodePath: _previousNodePath,
    isArchivePage,
    isProjectsPage,
    isResourcesPage,
    currentNodeId,
    onClose,
    canPreviewNode = false,
    depthOffset: _depthOffset = 0,
  } = props;

  const pageType = isArchivePage
    ? 'trash'
    : isProjectsPage
      ? 'projects'
      : isResourcesPage
        ? 'resources'
        : 'default';

  const pageColor = isArchivePage
    ? '#d32f2f'
    : isProjectsPage
      ? '#1976d2'
      : isResourcesPage
        ? '#388e3c'
        : '#666';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Typography variant="h6" component="h1" noWrap>
          {title}
        </Typography>
        {currentNodeInfo && (
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Current: {currentNodeInfo.name} ({currentNodeInfo.type})
              {currentNodeInfo.hasChildren && ' - Has Children'}
            </Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.5,
            backgroundColor: pageColor,
            color: 'white',
            borderRadius: 1,
            textTransform: 'uppercase',
            fontSize: '0.7rem',
          }}
        >
          {pageType}
        </Typography>

        {isArchivePage && (
          <Typography
            variant="caption"
            sx={{
              px: 1,
              py: 0.5,
              backgroundColor: '#d32f2f',
              color: 'white',
              borderRadius: 1,
              fontSize: '0.7rem',
            }}
          >
            TRASH
          </Typography>
        )}

        {canPreviewNode && currentNodeId && (
          <Button
            onClick={() => console.log('PreviewStep:', currentNodeId)}
            style={{
              padding: '4px 8px',
              backgroundColor: pageColor,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Preview
          </Button>
        )}

        {/*
*/}
        {onClose && (
          <Button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Close
          </Button>
        )}
      </Box>
    </Box>
  );
}
