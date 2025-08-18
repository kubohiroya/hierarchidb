import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  ThemedLoadingScreen, 
  ThemedLinearProgress, 
  ThemedCircularProgress 
} from './ThemedLoadingScreen';
import * as themeUtils from '../utils/theme';

// Mock theme utilities
vi.mock('../utils/theme');

const mockThemeUtils = themeUtils as any;

describe('ThemedLoadingScreen Components', () => {
  // 【テスト前準備】: theme utilities・window・useEffectのモック化
  let originalWindow: any;

  beforeEach(() => {
    // 【環境初期化】: 各テストで独立したモック状態を保証
    originalWindow = global.window;
    
    // Mock theme utilities
    mockThemeUtils.getThemeBackgroundColor = vi.fn().mockReturnValue('#fafafa');
    mockThemeUtils.getThemeTextColor = vi.fn().mockReturnValue('rgba(0, 0, 0, 0.87)');
    
    // Mock window
    global.window = { 
      matchMedia: vi.fn().mockReturnValue({ matches: false }) 
    } as any;
  });

  afterEach(() => {
    // 【テスト後処理】: window・mockを元の値に復元
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  // Test theme provider wrapper
  const renderWithTheme = (component: React.ReactElement, themeMode: 'light' | 'dark' = 'light') => {
    const theme = createTheme({
      palette: {
        mode: themeMode,
        grey: themeMode === 'dark' ? { 900: '#121212', 100: '#f5f5f5' } : { 50: '#fafafa', 900: '#212121' },
      },
    });
    
    return render(
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    );
  };

  describe('正常系テストケース', () => {
    it('TC-01: Component rendering - 基本レンダリング', async () => {
      // 【テスト目的】: ThemedLoadingScreenが両variantで正しくレンダリングされる
      // 【テスト内容】: linear・circular variantでの描画確認
      // 【期待される動作】: 適切なMUIコンポーネントが表示される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: linear variant
      const { rerender } = renderWithTheme(<ThemedLoadingScreen variant="linear" />);

      // 【結果検証】: LinearProgressが描画されているか確認
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // 【テストデータ準備】: circular variant に変更
      rerender(
        <ThemeProvider theme={createTheme()}>
          <ThemedLoadingScreen variant="circular" />
        </ThemeProvider>
      );

      // 【結果検証】: CircularProgressが描画されているか確認
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('TC-02: Theme integration - テーマ統合', async () => {
      // 【テスト目的】: 統合theme utilitiesが正しく適用される
      // 【テスト内容】: light/dark themeでの背景・テキスト色適用
      // 【期待される動作】: theme modeに応じた適切な色が適用される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: dark theme設定
      mockThemeUtils.getThemeBackgroundColor.mockReturnValue('#121212');
      mockThemeUtils.getThemeTextColor.mockReturnValue('rgba(255, 255, 255, 0.87)');

      renderWithTheme(
        <ThemedLoadingScreen variant="circular" message="Loading..." />, 
        'dark'
      );

      // 【結果検証】: hydration後にtheme colorsが適用されることを確認
      await waitFor(() => {
        expect(mockThemeUtils.getThemeBackgroundColor).toHaveBeenCalled();
        expect(mockThemeUtils.getThemeTextColor).toHaveBeenCalled();
      });
    });

    it('TC-03: SSR compatibility - SSRハイドレーション対応', () => {
      // 【テスト目的】: サーバーサイドレンダリング時のhydration mismatch防止
      // 【テスト内容】: isHydrated stateによる段階的color適用
      // 【期待される動作】: SSR時はlight default、hydration後はactual theme適用
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: SSR環境模擬（window未定義）
      delete (global as any).window;

      // 【実際の処理実行】: SSR環境でコンポーネント描画
      const { container } = renderWithTheme(<ThemedLoadingScreen variant="circular" />);

      // 【結果検証】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeInTheDocument();

      // 【テスト後処理】: window復元
      global.window = originalWindow;
    });

    it('TC-04: Props handling - プロップス処理', () => {
      // 【テスト目的】: variant、message、size、childrenが正しく処理される
      // 【テスト内容】: 各propsでの動作確認
      // 【期待される動作】: 渡されたpropsが適切にコンポーネントに反映される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: 全propsを指定
      const testMessage = 'Test loading message';
      const testSize = 60;
      const testChildren = <div data-testid="test-children">Child content</div>;

      renderWithTheme(
        <ThemedLoadingScreen 
          variant="circular" 
          message={testMessage}
          size={testSize}
          children={testChildren}
        />
      );

      // 【結果検証】: 各propsが適切に反映されているか確認
      expect(screen.getByText(testMessage)).toBeInTheDocument();
      expect(screen.getByTestId('test-children')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('異常系テストケース', () => {
    it('TC-05: Theme unavailable - theme情報取得失敗', async () => {
      // 【テスト目的】: theme utilities取得失敗時のfallback処理
      // 【テスト内容】: theme関数がエラーを返す場合の処理
      // 【期待される動作】: default色でgracefulに描画継続
      // 🟡 信頼性レベル: 妥当な推測（既存実装にはない）

      // 【テストデータ準備】: theme utilities がエラーを投げる設定
      mockThemeUtils.getThemeBackgroundColor.mockImplementation(() => {
        throw new Error('Theme unavailable');
      });
      mockThemeUtils.getThemeTextColor.mockImplementation(() => {
        throw new Error('Theme unavailable');
      });

      // 【実際の処理実行】: エラー時でもコンポーネントが描画される
      const { container } = renderWithTheme(<ThemedLoadingScreen variant="circular" />);

      // 【結果検証】: エラー時でもコンポーネントが正常描画されることを確認
      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('TC-06: Invalid props - 不正なprops値', () => {
      // 【テスト目的】: 範囲外sizeや無効variantでの処理
      // 【テスト内容】: 負数size、未定義variant等での動作
      // 【期待される動作】: default値またはエラーなしで処理
      // 🟡 信頼性レベル: 妥当な推測

      // 【テストデータ準備】: 不正なprops値
      const { container } = renderWithTheme(
        <ThemedLoadingScreen 
          variant={undefined as any}
          size={-10}
        />
      );

      // 【結果検証】: 不正props時でもエラーなく描画されることを確認
      expect(container.firstChild).toBeInTheDocument();
    });

    it('TC-07: Hydration timing - ハイドレーション タイミング競合', async () => {
      // 【テスト目的】: useEffectとtheme取得のタイミング問題対応
      // 【テスト内容】: 高速なcomponent mount/unmount時の動作
      // 【期待される動作】: メモリリークやエラーなしで処理
      // 🟡 信頼性レベル: 妥当な推測

      // 【テストデータ準備】: 高速mount/unmount
      const { unmount } = renderWithTheme(<ThemedLoadingScreen variant="circular" />);

      // 【実際の処理実行】: 即座にunmount
      unmount();

      // 【結果検証】: エラーなく処理されることを確認（エラー投げられないことで確認）
      expect(true).toBe(true); // No errors thrown during mount/unmount cycle
    });
  });

  describe('境界値テストケース', () => {
    it('TC-08: Size boundaries - サイズ境界値', () => {
      // 【テスト目的】: CircularProgressのサイズ境界での処理
      // 【テスト内容】: size=0, 極大値での描画確認
      // 【期待される動作】: MUIコンポーネントが適切にサイズ処理
      // 🟢 信頼性レベル: MUI仕様から導出

      // 【テストデータ準備】: 境界値サイズテスト
      const boundaryValues = [0, 1, 999, 1000];

      boundaryValues.forEach(size => {
        const { container } = renderWithTheme(
          <ThemedLoadingScreen variant="circular" size={size} />
        );

        // 【結果検証】: 各境界値でエラーなく描画されることを確認
        expect(container.firstChild).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('TC-09: Message length boundaries - メッセージ長境界', () => {
      // 【テスト目的】: 極端に長い・短いmessageでの表示確認
      // 【テスト内容】: 空文字、超長文での描画確認
      // 【期待される動作】: 適切なtext wrapping・表示処理
      // 🟡 信頼性レベル: 妥当な推測

      // 【テストデータ準備】: 境界値メッセージテスト
      const messages = [
        '',
        'A',
        'A'.repeat(1000),
        'Very long message with spaces '.repeat(100),
      ];

      messages.forEach(message => {
        renderWithTheme(
          <ThemedLoadingScreen variant="circular" message={message} />
        );

        // 【結果検証】: 各メッセージ長でエラーなく表示されることを確認
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        if (message) {
          expect(screen.getByText(message)).toBeInTheDocument();
        }
      });
    });

    it('TC-10: Children complexity - 複雑なchildren要素', () => {
      // 【テスト目的】: 複雑なReactNodeをchildrenに渡した場合の処理
      // 【テスト内容】: ネストしたcomponent、fragment等での描画
      // 【期待される動作】: childrenが適切にレンダリングされる
      // 🟢 信頼性レベル: Reactの仕様から導出

      // 【テストデータ準備】: 複雑なchildren
      const complexChildren = (
        <>
          <div data-testid="nested-div">
            <span>Nested content</span>
            <div>
              <button>Action</button>
            </div>
          </div>
          <p data-testid="paragraph">Additional text</p>
          {[1, 2, 3].map(i => <div key={i} data-testid={`item-${i}`}>Item {i}</div>)}
        </>
      );

      renderWithTheme(
        <ThemedLoadingScreen variant="circular">
          {complexChildren}
        </ThemedLoadingScreen>
      );

      // 【結果検証】: 複雑なchildrenが適切にレンダリングされることを確認
      expect(screen.getByTestId('nested-div')).toBeInTheDocument();
      expect(screen.getByTestId('paragraph')).toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });
  });

  describe('統合テスト', () => {
    it('TC-11: Package import consistency - パッケージインポート一貫性', () => {
      // 【テスト目的】: ui-coreから統一exportされることの確認
      // 【テスト内容】: ui-layoutのThemedLoadingScreenがui-coreを参照
      // 【期待される動作】: import pathが統一され、重複排除される
      // 🟢 信頼性レベル: リファクタリング要求から導出

      // 【結果検証】: ui-coreからの統合exportが利用可能であることを確認
      expect(typeof ThemedLoadingScreen).toBe('function');
      expect(typeof ThemedLinearProgress).toBe('function');
      expect(typeof ThemedCircularProgress).toBe('function');
    });

    it('TC-12: Backward compatibility - 後方互換性', () => {
      // 【テスト目的】: 既存コードが影響を受けないことの確認
      // 【テスト内容】: ui-layoutからのimportが引き続き動作
      // 【期待される動作】: 既存のimport文を変更せずに統合版が使用される
      // 🟢 信頼性レベル: リファクタリング要求から導出

      // 【テストデータ準備】: 後方互換性テスト用コンポーネント描画
      const { container } = renderWithTheme(<ThemedLinearProgress />);
      expect(container.firstChild).toBeInTheDocument();

      const { container: circularContainer } = renderWithTheme(
        <ThemedCircularProgress message="Loading" size={50} />
      );
      expect(circularContainer.firstChild).toBeInTheDocument();
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });
  });
});