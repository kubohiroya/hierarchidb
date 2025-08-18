import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStoredThemeMode,
  getSystemTheme,
  getActualTheme,
  getThemeBackgroundColor,
  getThemeTextColor,
  getThemeIcon,
  getThemeDisplayName,
  getBackgroundColorForTheme,
  getTextColorForTheme,
  type ThemeMode,
} from './theme';

describe('Theme Utilities', () => {
  // 【テスト前準備】: window・localStorage・matchMediaのモック化
  // 【環境初期化】: 各テストで独立したモック状態を保証
  let originalWindow: any;
  let originalLocalStorage: any;

  beforeEach(() => {
    // 【テスト前準備】: window・localStorage・matchMediaをモック
    // 【環境初期化】: 前のテストの影響を受けないようモックをリセット
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    // Mock window with matchMedia
    const mockMatchMedia = vi.fn();
    global.window = {
      localStorage: localStorageMock,
      matchMedia: mockMatchMedia,
    } as any;
    global.localStorage = localStorageMock;
  });

  afterEach(() => {
    // 【テスト後処理】: window・localStorageを元の値に復元
    // 【状態復元】: 次のテストに影響しないようモックをクリア
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
    vi.restoreAllMocks();
  });

  describe('正常系テストケース', () => {
    it('TC-01: Theme mode utilities - 基本動作', () => {
      // 【テスト目的】: Theme mode取得・設定関数が正しく動作する
      // 【テスト内容】: getStoredThemeMode, getSystemTheme, getActualThemeの動作確認
      // 【期待される動作】: 各theme modeが正しく取得・判定される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: localStorage に 'dark' theme を設定
      // 【初期条件設定】: ユーザーがdark themeを選択済みの状態を模擬
      localStorage.getItem = vi.fn().mockReturnValue('dark');
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      // 【実際の処理実行】: theme mode取得関数を呼び出し
      // 【処理内容】: stored theme, system theme, actual themeを取得
      const storedTheme = getStoredThemeMode();
      const systemTheme = getSystemTheme();
      const actualTheme = getActualTheme();

      // 【結果検証】: 各theme mode関数が期待値を返すか確認
      // 【期待値確認】: stored='dark', system='light', actual='dark'
      expect(storedTheme).toBe('dark'); // 【確認内容】: localStorage から正しく取得されているか 🟢
      expect(systemTheme).toBe('light'); // 【確認内容】: matchMedia.matches=false でlight判定か 🟢
      expect(actualTheme).toBe('dark'); // 【確認内容】: stored theme が優先されているか 🟢
    });

    it('TC-02: Theme styling utilities - 色の取得', () => {
      // 【テスト目的】: Theme対応の色取得関数が正しく動作する
      // 【テスト内容】: getThemeBackgroundColor, getThemeTextColorの色取得
      // 【期待される動作】: Light/Dark theme時に適切な色が返される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: dark themeを設定
      // 【初期条件設定】: ユーザーがdark themeを使用中を模擬
      localStorage.getItem = vi.fn().mockReturnValue('dark');

      // 【実際の処理実行】: theme色取得関数を呼び出し
      // 【処理内容】: background色とtext色を取得
      const backgroundColor = getThemeBackgroundColor();
      const textColor = getThemeTextColor();

      // 【結果検証】: dark theme用の色が返されるか確認
      // 【期待値確認】: dark theme用の背景色・テキスト色
      expect(backgroundColor).toBe('#121212'); // 【確認内容】: dark theme背景色が返されているか 🟢
      expect(textColor).toBe('rgba(255, 255, 255, 0.87)'); // 【確認内容】: dark themeテキスト色が返されているか 🟢
    });

    it('TC-03: Theme display utilities - アイコン・ラベル', () => {
      // 【テスト目的】: Theme表示用のutility関数が正しく動作する
      // 【テスト内容】: getThemeIcon, getThemeDisplayNameの表示用データ取得
      // 【期待される動作】: 各theme modeに対応したアイコン・ラベルが返される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: 各theme modeのテストデータ
      // 【初期条件設定】: UI表示用のアイコン・ラベル取得を模擬
      const testModes: ThemeMode[] = ['light', 'dark', 'system'];

      testModes.forEach((mode) => {
        // 【実際の処理実行】: 表示用utility関数を呼び出し
        // 【処理内容】: アイコンとラベルを取得
        const icon = getThemeIcon(mode);
        const displayName = getThemeDisplayName(mode);

        // 【結果検証】: 各theme modeに対応したアイコン・ラベルが返されるか確認
        // 【期待値確認】: theme modeごとの適切なアイコン・ラベル
        expect(typeof icon).toBe('string'); // 【確認内容】: アイコンが文字列で返されているか 🟢
        expect(typeof displayName).toBe('string'); // 【確認内容】: 表示名が文字列で返されているか 🟢
        expect(icon.length).toBeGreaterThan(0); // 【確認内容】: アイコンが空でないか 🟢
        expect(displayName.length).toBeGreaterThan(0); // 【確認内容】: 表示名が空でないか 🟢
      });
    });

    it('TC-04: SSR compatibility - サーバーサイドレンダリング対応', () => {
      // 【テスト目的】: SSR環境でtheme utilities がhydration mismatch を起こさない
      // 【テスト内容】: window 未定義時のfallback動作
      // 【期待される動作】: SSR時にlight theme defaultが返される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: SSR環境を模擬（window未定義）
      // 【初期条件設定】: サーバーサイドレンダリング時の状態を模擬
      const originalWindow = global.window;
      delete (global as any).window;

      // 【実際の処理実行】: SSR環境でtheme utility関数を呼び出し
      // 【処理内容】: window未定義時のfallback処理
      const storedTheme = getStoredThemeMode();
      const systemTheme = getSystemTheme();
      const backgroundColor = getThemeBackgroundColor();
      const textColor = getThemeTextColor();

      // 【結果検証】: SSR環境でlight theme defaultが返されるか確認
      // 【期待値確認】: hydration mismatch防止のためのlight theme default
      expect(storedTheme).toBe('system'); // 【確認内容】: SSR時にsystem defaultが返されているか 🟢
      expect(systemTheme).toBe('light'); // 【確認内容】: SSR時にlight defaultが返されているか 🟢
      expect(backgroundColor).toBe('#fafafa'); // 【確認内容】: SSR時にlight背景色が返されているか 🟢
      expect(textColor).toBe('rgba(0, 0, 0, 0.87)'); // 【確認内容】: SSR時にlightテキスト色が返されているか 🟢

      // 【テスト後処理】: window を復元
      global.window = originalWindow;
    });
  });

  describe('異常系テストケース', () => {
    it('TC-05: LocalStorage access failure - ストレージアクセス失敗', () => {
      // 【テスト目的】: localStorage読み取り失敗時の適切なfallback
      // 【テスト内容】: localStorage例外発生時の処理
      // 【期待される動作】: エラー時にdefault値('system')を返す
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: localStorage.getItemが例外を投げるよう設定
      // 【初期条件設定】: プライベートモードなどでlocalStorage使用不可を模擬
      localStorage.getItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage is not available');
      });

      // 【実際の処理実行】: localStorage例外発生時のtheme取得
      // 【処理内容】: 例外処理とfallback値の返却
      const storedTheme = getStoredThemeMode();

      // 【結果検証】: 例外時にdefault値が返されるか確認
      // 【期待値確認】: graceful fallbackとしてsystem modeが返される
      expect(storedTheme).toBe('system'); // 【確認内容】: localStorage例外時にdefault値が返されているか 🟢
    });

    it('TC-06: Invalid theme mode - 不正なtheme mode値', () => {
      // 【テスト目的】: 不正な値がlocalStorageにある場合の処理
      // 【テスト内容】: 無効な文字列がstoredされている場合
      // 【期待される動作】: default値('system')を返す
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: 不正な値をlocalStorageに設定
      // 【初期条件設定】: データ破損や不正操作によるinvalid値を模擬
      localStorage.getItem = vi.fn().mockReturnValue('invalid-theme-mode');

      // 【実際の処理実行】: 不正値に対するvalidation処理
      // 【処理内容】: 値の妥当性チェックとdefault値の返却
      const storedTheme = getStoredThemeMode();

      // 【結果検証】: 不正値時にdefault値が返されるか確認
      // 【期待値確認】: validation failureでsystem modeが返される
      expect(storedTheme).toBe('system'); // 【確認内容】: 不正値時にdefault値が返されているか 🟢
    });

    it('TC-07: matchMedia unsupported - 古いブラウザ対応', () => {
      // 【テスト目的】: matchMediaが未対応のブラウザでのfallback
      // 【テスト内容】: window.matchMediaが未定義の場合
      // 【期待される動作】: light themeをdefaultとして返す
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: matchMedia未対応ブラウザを模擬
      // 【初期条件設定】: 古いブラウザやmatchMedia未実装環境を模擬
      window.matchMedia = undefined as any;

      // 【実際の処理実行】: matchMedia未対応時のsystem theme判定
      // 【処理内容】: matchMedia未定義時のfallback処理
      const systemTheme = getSystemTheme();

      // 【結果検証】: matchMedia未対応時にlight defaultが返されるか確認
      // 【期待値確認】: 古いブラウザでもgraceful degradation
      expect(systemTheme).toBe('light'); // 【確認内容】: matchMedia未対応時にlight defaultが返されているか 🟢
    });
  });

  describe('境界値テストケース', () => {
    it('TC-08: Theme mode boundaries - 全theme mode網羅', () => {
      // 【テスト目的】: 全てのtheme mode('light', 'dark', 'system')の処理確認
      // 【テスト内容】: 各theme modeでの全utility関数動作
      // 【期待される動作】: 全modeで一貫した動作
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: 全theme modeをテスト
      // 【初期条件設定】: 各theme modeでのutility動作確認を模擬
      const allModes: ThemeMode[] = ['light', 'dark', 'system'];

      allModes.forEach((mode) => {
        localStorage.getItem = vi.fn().mockReturnValue(mode);
        window.matchMedia = vi.fn().mockReturnValue({ matches: mode === 'dark' });

        // 【実際の処理実行】: 各theme modeでutility関数を実行
        // 【処理内容】: 全utility関数の一貫性チェック
        const storedTheme = getStoredThemeMode();
        const icon = getThemeIcon(mode);
        const displayName = getThemeDisplayName(mode);

        // 【結果検証】: 各theme modeで一貫した動作をするか確認
        // 【期待値確認】: mode boundaries でのエラーなし
        expect(['light', 'dark', 'system']).toContain(storedTheme); // 【確認内容】: 有効なtheme modeが返されているか 🟢
        expect(typeof icon).toBe('string'); // 【確認内容】: アイコンが取得できているか 🟢
        expect(typeof displayName).toBe('string'); // 【確認内容】: 表示名が取得できているか 🟢
      });
    });

    it('TC-09: System theme detection - システムtheme検出境界', () => {
      // 【テスト目的】: システムのcolor-scheme設定変化への対応
      // 【テスト内容】: prefers-color-schemeのlight/dark切り替え
      // 【期待される動作】: システム設定に従った適切なtheme判定
      // 🟡 信頼性レベル: 妥当な推測

      // 【テストデータ準備】: system color scheme の各パターンをテスト
      // 【初期条件設定】: ユーザーのOS theme設定変更を模擬
      const systemSettings = [
        { matches: true, expected: 'dark' },
        { matches: false, expected: 'light' },
      ];

      systemSettings.forEach(({ matches, expected }) => {
        window.matchMedia = vi.fn().mockReturnValue({ matches });

        // 【実際の処理実行】: system theme検出
        // 【処理内容】: prefers-color-schemeに基づくtheme判定
        const systemTheme = getSystemTheme();

        // 【結果検証】: system設定に対応したthemeが返されるか確認
        // 【期待値確認】: matchMediaの結果に応じた適切なtheme判定
        expect(systemTheme).toBe(expected); // 【確認内容】: system設定に対応したthemeが返されているか 🟡
      });
    });

    it('TC-10: MUI theme integration - Material-UIテーマ統合', () => {
      // 【テスト目的】: Material-UIテーマオブジェクトとの互換性確認
      // 【テスト内容】: MUIのtheme objectから色情報を正しく取得
      // 【期待される動作】: MUI theme paletteから適切な色が取得される
      // 🟢 信頼性レベル: 現在の実装から直接導出

      // 【テストデータ準備】: MUI theme objectを模擬
      // 【初期条件設定】: Material-UI theme構造を持つオブジェクトを作成
      const mockDarkTheme = {
        palette: {
          mode: 'dark',
          grey: { 900: '#121212', 100: '#f5f5f5' },
        },
      };

      const mockLightTheme = {
        palette: {
          mode: 'light',
          grey: { 50: '#fafafa', 900: '#212121' },
        },
      };

      // 【実際の処理実行】: MUI theme objectからcolor取得
      // 【処理内容】: theme paletteに基づく色情報取得
      const darkBg = getBackgroundColorForTheme(mockDarkTheme);
      const darkText = getTextColorForTheme(mockDarkTheme);
      const lightBg = getBackgroundColorForTheme(mockLightTheme);
      const lightText = getTextColorForTheme(mockLightTheme);

      // 【結果検証】: MUI theme paletteから適切な色が取得されるか確認
      // 【期待値確認】: MUI theme構造との互換性
      expect(darkBg).toBe('#121212'); // 【確認内容】: dark theme背景色がMUI paletteから取得されているか 🟢
      expect(darkText).toBe('#f5f5f5'); // 【確認内容】: dark themeテキスト色がMUI paletteから取得されているか 🟢
      expect(lightBg).toBe('#fafafa'); // 【確認内容】: light theme背景色がMUI paletteから取得されているか 🟢
      expect(lightText).toBe('#212121'); // 【確認内容】: light themeテキスト色がMUI paletteから取得されているか 🟢
    });
  });
});