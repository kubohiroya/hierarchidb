/**
  * TreeConsoleFooter -
  * eria-cartographTreeConsoleFooterUI
   */

import { Box, IconButton, Typography } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import type { TreeConsoleFooterProps } from '../types.js';

/**
  * TreeConsoleFooter
 * TreeConsoleFooter
  */
export function TreeConsoleFooter(props: TreeConsoleFooterProps): React.JSX.Element {
  const {
    controller,
    onStartTour,
    height = 32,
    showTour = true,
    customText,
    position = 'absolute',
  } = props;

  if (customText) {
    return (
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          padding: 0,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          backgroundColor: 'background.paper',
          position,
          ...(position === 'absolute' && {
            left: 0,
            bottom: 0,
            width: '100%',
          }),
          height,
        }}
      >
        {showTour && onStartTour ? (
          <IconButton
            size="small"
            onClick={onStartTour}
            aria-label="Start guided tour"
            sx={{
              mr: 1,
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
            }}
          >
            <HelpOutline fontSize="small" />
          </IconButton>
        ) : (
          <Box sx={{ width: 16, color: 'text.secondary' }} />
        )}
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
        >
          {customText}
        </Typography>
      </Box>
    );
  }

  if (!controller) {
    return (
      <Box
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          padding: 0,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          backgroundColor: 'background.paper',
          position,
          ...(position === 'absolute' && {
            left: 0,
            bottom: 0,
            width: '100%',
          }),
          height,
        }}
      >
        {showTour && onStartTour ? (
          <IconButton
            size="small"
            onClick={onStartTour}
            aria-label="Start guided tour"
            sx={{
              mr: 1,
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
            }}
          >
            <HelpOutline fontSize="small" />
          </IconButton>
        ) : (
          <Box sx={{ width: 16, color: 'text.secondary' }} />
        )}
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
        >
          Loading...
        </Typography>
      </Box>
    );
  }

  const getFooterText = () => {
    const selectedCount = Object.keys(controller?.rowSelection || {}).length;
    const filteredCount = controller?.filteredItemCount ?? controller?.data?.length ?? 0;
    const totalCount = controller?.totalItemCount || filteredCount;

    const parts = [];

    if (selectedCount > 0) {
      parts.push(`${selectedCount} selected`);
    }

    //  /
    if (controller?.searchText && controller.searchText.trim() !== '') {
      parts.push(`${filteredCount} found`);
      parts.push(`${totalCount} total`);
    } else if (totalCount !== filteredCount) {
      parts.push(`${filteredCount} ${filteredCount <= 1 ? 'branch' : 'branches'}`);
      parts.push(`${totalCount} ${totalCount === 1 ? 'node' : 'nodes'} shown`);
    } else {
      parts.push(`${totalCount} ${totalCount === 1 ? 'node' : 'nodes'} shown`);
    }

    return parts.join(' • ');
  };

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        padding: 0,
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: 'background.paper',
        position,
        ...(position === 'absolute' && {
          left: 0,
          bottom: 0,
          width: '100%',
        }),
        height,
      }}
    >
      {showTour && onStartTour ? (
        <IconButton
          size="small"
          onClick={onStartTour}
          aria-label="Start guided tour"
          sx={{
            mr: 1,
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          <HelpOutline fontSize="small" />
        </IconButton>
      ) : (
        <Box sx={{ width: 16, color: 'text.secondary' }} />
      )}
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary' }}
      >
        {getFooterText()}
      </Typography>
    </Box>
  );
}
