/**
 * TreeConsoleFooter - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleFooterのUIを正確に再現。
 * 選択数・フィルタ件数・総件数の要約表示とガイド起動ボタン。
 */

import { Box, IconButton, Typography } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import type { TreeConsoleFooterProps } from '../types';

/**
 * TreeConsoleFooter メインコンポーネント
 * 元のTreeConsoleFooterの構造とロジックを完全に再現
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

  // カスタムテキストが指定されている場合はそれを使用
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

  // コントローラーが無い場合のフォールバック表示
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
