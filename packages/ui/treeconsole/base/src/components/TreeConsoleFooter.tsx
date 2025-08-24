/**
 * TreeConsoleFooter - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleFooterのUIを正確に再現。
 * 選択数・フィルタ件数・総件数の要約表示とガイド起動ボタン。
 */

import { Box, IconButton, Typography } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { useTheme, type Theme } from '@mui/material/styles';
import styled from '@emotion/styled';
import type { TreeConsoleFooterProps } from '../types/index';

/**
 * FooterContainer - 元のスタイルを再現
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
 * FooterText - 元のスタイルを再現
 */
const FooterText = styled(Typography)`
  color: ${({ theme }: { theme: Theme }) => theme.palette.text.secondary};
`;

/**
 * TreeConsoleFooter メインコンポーネント
 * 元のTreeConsoleFooterの構造とロジックを完全に再現
 */
export function TreeConsoleFooter(props: TreeConsoleFooterProps): React.JSX.Element {
  const { controller, onStartTour, height = 32 } = props;

  const theme = useTheme();

  // コントローラーが無い場合のフォールバック表示
  if (!controller) {
    return (
      <FooterContainer theme={theme}>
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
        <FooterText variant="body2" theme={theme}>
          Loading...
        </FooterText>
      </FooterContainer>
    );
  }

  // フッターテキストの生成（元のロジックを完全に再現）
  const getFooterText = () => {
    const selectedCount = Object.keys(controller?.rowSelection || {}).length;
    const filteredCount = controller?.filteredItemCount ?? controller?.data?.length ?? 0;
    const totalCount = controller?.totalItemCount || filteredCount;

    const parts = [];

    // 選択数の表示
    if (selectedCount > 0) {
      parts.push(`${selectedCount} selected`);
    }

    // 検索/フィルタリング状態に応じた表示
    if (controller?.searchText && controller.searchText.trim() !== '') {
      // 検索中の表示
      parts.push(`${filteredCount} found`);
      parts.push(`${totalCount} total`);
    } else if (totalCount !== filteredCount) {
      // フィルタリング中の表示
      parts.push(`${filteredCount} ${filteredCount <= 1 ? 'branch' : 'branches'}`);
      parts.push(`${totalCount} ${totalCount === 1 ? 'node' : 'nodes'} shown`);
    } else {
      // 通常の表示
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
      }}
    >
      {onStartTour ? (
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
      <FooterText variant="body2" theme={theme}>
        {getFooterText()}
      </FooterText>
    </FooterContainer>
  );
}
