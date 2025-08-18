/**
 * TreeConsoleFooter
 * 
 * フッターコンポーネント。選択数、表示数等のステータス表示とツアー機能を提供。
 * 
 * 移植戦略：
 * 1. 基本レイアウトとステータス表示
 * 2. ツアー開始ボタン統合
 * 3. 検索・フィルタリング状態の表示
 */

import { Box, IconButton, Typography } from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import type { TreeConsoleFooterProps } from '~/types';

const FooterContainer = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: '4px 8px',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  backgroundColor: theme.palette.background.paper,
}));

const FooterText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

/**
 * TreeConsoleFooter コンポーネント
 */
export function TreeConsoleFooter(props: TreeConsoleFooterProps): JSX.Element {
  const { controller, onStartTour, height = 32 } = props;

  // コントローラーがない場合
  if (!controller) {
    return (
      <FooterContainer sx={{ height }}>
        {onStartTour && (
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
        )}
        <FooterText variant="body2">読み込み中...</FooterText>
      </FooterContainer>
    );
  }

  // フッターテキストの生成
  const getFooterText = (): string => {
    const selectedCount = controller?.selectedNodes?.length || 0;
    const expandedCount = controller?.expandedNodes?.length || 0;
    
    // TODO: 実装時に実際のフィルタリング・検索結果数を取得
    const filteredCount = selectedCount; // プレースホルダー
    const totalCount = expandedCount; // プレースホルダー
    
    const parts: string[] = [];

    // 選択数
    if (selectedCount > 0) {
      parts.push(`${selectedCount}個選択中`);
    }

    // 検索・フィルタリング状態（IndexedDB制約により検索未実装）
    const hasSearch = controller?.searchText && controller.searchText.trim() !== "";
    
    if (hasSearch) {
      parts.push("検索未実装 (IndexedDB制約)");
      parts.push(`全${totalCount}件`);
    } else if (totalCount !== filteredCount) {
      parts.push(`${filteredCount}${filteredCount <= 1 ? 'ブランチ' : 'ブランチ'}`);
      parts.push(`${totalCount}${totalCount === 1 ? 'ノード' : 'ノード'}表示中`);
    } else {
      parts.push(`${totalCount}${totalCount === 1 ? 'ノード' : 'ノード'}表示中`);
    }

    return parts.join(' • ');
  };

  return (
    <FooterContainer sx={{ height }}>
      {/* ツアー開始ボタン */}
      {onStartTour && (
        <IconButton
          size="small"
          onClick={onStartTour}
          aria-label="ガイドツアーを開始"
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
      )}

      {/* ステータステキスト */}
      <FooterText variant="body2">{getFooterText()}</FooterText>

      {/* 右側の追加情報（開発時のデバッグ） */}
      <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
        <FooterText variant="caption" sx={{ fontSize: '0.7rem' }}>
          Controller: {controller ? 'OK' : 'None'}
        </FooterText>
        {controller?.isLoading && (
          <FooterText variant="caption" sx={{ fontSize: '0.7rem', color: 'warning.main' }}>
            Loading...
          </FooterText>
        )}
      </Box>
    </FooterContainer>
  );
}