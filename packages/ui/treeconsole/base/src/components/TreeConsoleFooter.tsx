/**
  * TreeConsoleFooter -
  * eria-cartographTreeConsoleFooterUI
   */

import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { type Theme, useTheme } from '@mui/material/styles';
import styled from '@emotion/styled';
import type { TreeConsoleFooterProps } from '../types/index.js';

/**
  * FooterContainer -
  */
const FooterContainer = styled(Box)`
  border-top: 1px solid;
  border-color: ${({ theme }: { theme: Theme }) => theme.palette.divider};
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: ${({ theme }: { theme: Theme }) => theme.palette.background.paper};
`;

/**
  * FooterText -
  */
const FooterText = styled(Typography)`
  color: ${({ theme }: { theme: Theme }) => theme.palette.text.secondary};
`;

/**
  * TreeConsoleFooter
 * TreeConsoleFooter
  */
export function TreeConsoleFooter(props: TreeConsoleFooterProps): React.JSX.Element {
  const { controller, onStartTour, height = 32, loadingText, loadingTooltip } = props;

  const theme = useTheme();

  if (!controller) {
    return (
      <FooterContainer
        theme={theme}
        sx={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          px: 1,
        }}
      >
        <IconButton
          size="small"
          onClick={onStartTour}
          disabled={!onStartTour}
          aria-label="Start guided tour"
          sx={{
            color: onStartTour ? 'text.secondary' : 'action.disabled',
            '&:hover': onStartTour ? {
              color: 'primary.main',
            } : {},
            '&.Mui-disabled': {
              color: 'action.disabled',
            },
          }}
        >
          <HelpOutline fontSize="small" />
        </IconButton>
        <Tooltip title={loadingTooltip || ''} arrow disableHoverListener={!loadingTooltip}>
          <FooterText
            variant="body2"
            theme={theme}
            sx={{ ml: 2 }}
          >
            {loadingText ?? 'Loading...'}
          </FooterText>
        </Tooltip>
      </FooterContainer>
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
    <FooterContainer
      theme={theme}
      sx={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'center',
        px: 1,
      }}
    >
      {/* Help icon always on the left */}
      <IconButton
        size="small"
        onClick={onStartTour}
        disabled={!onStartTour}
        aria-label="Start guided tour"
        sx={{
          color: onStartTour ? 'text.secondary' : 'action.disabled',
          '&:hover': onStartTour ? {
            color: 'primary.main',
          } : {},
          '&.Mui-disabled': {
            color: 'action.disabled',
          },
        }}
      >
        <HelpOutline fontSize="small" />
      </IconButton>

      {/* Node counts display with left margin */}
      <FooterText
        variant="body2"
        theme={theme}
        sx={{ ml: 2 }}
      >
        {getFooterText()}
      </FooterText>
    </FooterContainer>
  );
}
