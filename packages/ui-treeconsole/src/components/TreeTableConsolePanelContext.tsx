/**
 * TreeTableConsolePanelContext
 * 
 * ResizeObserverを統合してTreeTableConsolePanelに適切な寸法を提供するラッパー。
 * 有効な寸法が取得できるまでレンダリングをブロックし、width:0問題を回避する。
 * 
 * 主な機能:
 * - ResizeObserverによる動的サイズ監視
 * - 有効な寸法確定まで描画制御
 * - ローディング状態の表示
 */

import { useRef, useState, useEffect, RefObject } from 'react';
import { Box, LinearProgress } from '@mui/material';
import { TreeTableConsolePanel } from './TreeTableConsolePanel';
import type { TreeTableConsolePanelProps } from '~/types';

/**
 * ResizeObserver統合hook（簡素版）
 */
function useResizeObserver(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // ResizeObserverが利用可能かチェック
    if (typeof ResizeObserver === 'undefined') {
      // フォールバック：要素の初期サイズを使用
      setSize({
        width: element.clientWidth || 800,
        height: element.clientHeight || 600,
      });
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    resizeObserver.observe(element);

    // 初期サイズの取得
    setSize({
      width: element.clientWidth,
      height: element.clientHeight,
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return size;
}

/**
 * 有効なサイズかどうかを判定するhook
 */
function useValidatedSize(ref: RefObject<HTMLElement | null>) {
  const size = useResizeObserver(ref);
  const isValid = size.width > 0 && size.height > 0;
  return { ...size, isValid };
}

/**
 * TreeTableConsolePanelContext
 * 
 * ResizeObserverを統合し、TreeTableConsolePanelが適切な寸法で描画されるよう制御する。
 */
export function TreeTableConsolePanelContext(props: TreeTableConsolePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    width,
    height,
    isValid: hasValidDimensions,
  } = useValidatedSize(containerRef);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // 子要素のオーバーフローを制御
      }}
    >
      {!hasValidDimensions ? (
        // 有効な寸法が取得できるまでローディング表示
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
            backgroundColor: 'background.default',
          }}
        >
          <LinearProgress
            color="primary"
            sx={{ width: '60%', mb: 2 }}
            aria-label="寸法を測定中..."
          />
          <Box
            sx={{
              fontSize: '0.875rem',
              color: 'text.secondary',
              textAlign: 'center',
            }}
          >
            コンテナサイズを測定中...
            <br />
            <Box component="span" sx={{ fontSize: '0.75rem' }}>
              {width} × {height}
            </Box>
          </Box>
        </Box>
      ) : (
        // 有効な寸法が確定したらTreeTableConsolePanelを描画
        <TreeTableConsolePanel
          {...props}
          containerWidth={width}
          containerHeight={height}
        />
      )}
    </Box>
  );
}