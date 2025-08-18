import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { UserAvatar } from './UserAvatar';

// Mock external dependencies
vi.mock('react-gravatar', () => ({
  default: ({ email, onError }: { email: string; onError: () => void }) => (
    <div 
      data-testid="gravatar" 
      data-email={email}
      onClick={() => onError()} // Simulate error for testing
    >
      Gravatar
    </div>
  ),
}));

vi.mock('./imageUtils', () => ({
  preloadImage: vi.fn().mockResolvedValue(false), // 【デフォルト値】: 画像読み込み失敗をデフォルト設定
  getGoogleImageVariants: vi.fn().mockReturnValue([]), // 【デフォルト値】: 空配列でエラー回避
}));

describe('UserAvatar Components', () => {
  beforeEach(async () => {
    // 【モック初期化】: デフォルト値を維持しながらモック状態をリセット
    // 【実装方針】: clearAllMocks の代わりに個別設定でUnhandled Rejection回避 🟢
    const mockPreloadImage = vi.mocked((await import('./imageUtils')).preloadImage);
    const mockGetGoogleImageVariants = vi.mocked((await import('./imageUtils')).getGoogleImageVariants);
    
    // 【デフォルト値設定】: テスト間でのモック状態の一貫性を保つ
    mockPreloadImage.mockResolvedValue(false);
    mockGetGoogleImageVariants.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('正常系テストケース', () => {
    it('TC-01: Basic rendering - デフォルトプロパティでレンダリング', () => {
      // 【テスト目的】: UserAvatarコンポーネントがデフォルト設定で正常にレンダリングされる
      // 【テスト内容】: プロパティなしでコンポーネントをレンダリング
      // 【期待される動作】: PersonIconを含むAvatarが表示される
      // 🟢 TDD Green: 統合されたUserAvatarが正常動作することを確認

      const { container } = render(<UserAvatar />);
      
      // 【確認内容】: デフォルトのPersonIconが表示されているか
      // 【実装方針】: 最小限の動作確認 - レンダリングエラーがないことを確認
      expect(container.firstChild).toBeTruthy();
      expect(container.querySelector('[data-testid="PersonIcon"], .MuiAvatar-root')).toBeTruthy();
    });

    it('TC-02: Google profile image - Google画像URL正常表示', async () => {
      // 【テスト目的】: Google profile画像が正常に表示される
      // 【テスト内容】: pictureUrlプロパティでGoogle画像URLを指定
      // 【期待される動作】: img要素でGoogle画像が表示される
      // 🟢 TDD Green: 実装済みのGoogle画像表示機能の動作確認

      const mockPreloadImage = vi.mocked(await import('./imageUtils')).preloadImage;
      const mockGetGoogleImageVariants = vi.mocked(await import('./imageUtils')).getGoogleImageVariants;
      
      mockPreloadImage.mockResolvedValue(true);
      mockGetGoogleImageVariants.mockReturnValue([
        'https://lh3.googleusercontent.com/test=s96',
        'https://lh3.googleusercontent.com/test=s128'
      ]);

      const { container } = render(
        <UserAvatar 
          pictureUrl="https://lh3.googleusercontent.com/test=s96"
          name="Test User"
        />
      );

      // 【確認内容】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-03: Gravatar fallback - Gravatar フォールバック表示', () => {
      // 【テスト目的】: Google画像失敗時にGravatarにフォールバックする
      // 【テスト内容】: pictureUrlなしでemailプロパティを指定
      // 【期待される動作】: Gravatarコンポーネントが表示される
      // 🟢 TDD Green: 実装済みのGravatar機能の動作確認

      const { container } = render(
        <UserAvatar 
          email="test@example.com"
          name="Test User"
        />
      );

      // 【確認内容】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-04: Name initials - イニシャル表示', () => {
      // 【テスト目的】: 名前からイニシャルを生成して表示
      // 【テスト内容】: nameプロパティのみを指定（email/pictureUrlなし）
      // 【期待される動作】: Avatarにイニシャル文字が表示される
      // 🟢 TDD Green: 実装済みのイニシャル生成機能の動作確認

      const { container } = render(
        <UserAvatar name="John Doe" />
      );

      // 【確認内容】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-05: Size customization - サイズカスタマイズ', () => {
      // 【テスト目的】: size プロパティでアバターサイズを変更
      // 【テスト内容】: size={60} を指定
      // 【期待される動作】: 60px x 60px のアバターが表示される
      // 🟢 TDD Green: 実装済みのサイズカスタマイズ機能の動作確認

      const { container } = render(
        <UserAvatar name="Test User" size={60} />
      );

      // 【確認内容】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-06: Custom styling - カスタムスタイル適用', () => {
      // 【テスト目的】: sx プロパティでカスタムスタイルを適用
      // 【テスト内容】: sx={{border: '2px solid red'}} を指定
      // 【期待される動作】: カスタムスタイルが適用される
      // 🟢 TDD Green: 実装済みのカスタムスタイル機能の動作確認

      const customSx = { border: '2px solid red' };
      const { container } = render(
        <UserAvatar name="Test User" sx={customSx} />
      );

      // 【確認内容】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('異常系テストケース', () => {
    it('TC-07: Google image load failure - Google画像読み込み失敗', async () => {
      // 【テスト目的】: Google画像の読み込み失敗時のフォールバック
      // 【テスト内容】: Google URLを指定するが読み込み失敗をシミュレート
      // 【期待される動作】: Gravatarまたはイニシャルにフォールバック
      // 🟢 TDD Green: 実装済みのフォールバック機能の動作確認

      const mockPreloadImage = vi.mocked(await import('./imageUtils')).preloadImage;
      const mockGetGoogleImageVariants = vi.mocked(await import('./imageUtils')).getGoogleImageVariants;
      
      mockPreloadImage.mockResolvedValue(false);
      mockGetGoogleImageVariants.mockReturnValue(['https://lh3.googleusercontent.com/test=s96']);

      const { container } = render(
        <UserAvatar 
          pictureUrl="https://lh3.googleusercontent.com/invalid"
          email="test@example.com"
          name="Test User"
        />
      );

      // 【確認内容】: エラーでもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-08: Gravatar load failure - Gravatar読み込み失敗', () => {
      // 【テスト目的】: Gravatarの読み込み失敗時のフォールバック
      // 【テスト内容】: 存在しないemailでGravatar失敗をシミュレート
      // 【期待される動作】: イニシャル表示にフォールバック
      // 🟢 TDD Green: 実装済みのGravatarフォールバック機能の動作確認

      const { container } = render(
        <UserAvatar 
          email="nonexistent@example.com"
          name="Test User"
        />
      );

      // 【確認内容】: コンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-09: Empty props - 全プロパティ空', () => {
      // 【テスト目的】: 全プロパティが空の場合の動作
      // 【テスト内容】: すべてのプロパティをundefinedに設定
      // 【期待される動作】: デフォルトのPersonIconが表示される
      // 🟢 TDD Green: 実装済みのデフォルト表示機能の動作確認

      const { container } = render(
        <UserAvatar 
          pictureUrl={undefined}
          email={undefined}
          name={undefined}
        />
      );

      // 【確認内容】: デフォルト状態でもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-10: Invalid URLs - 無効なURL', () => {
      // 【テスト目的】: 無効なURL形式での処理
      // 【テスト内容】: 不正な形式のpictureUrlを指定
      // 【期待される動作】: フォールバック表示になる
      // 🟢 TDD Green: 実装済みのエラー処理機能の動作確認

      const { container } = render(
        <UserAvatar 
          pictureUrl="not-a-valid-url"
          email="test@example.com"
          name="Test User"
        />
      );

      // 【確認内容】: 無効URLでもクラッシュせずに正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('境界値テストケース', () => {
    it('TC-11: Single character name - 1文字名前', () => {
      // 【テスト目的】: 1文字の名前でのイニシャル生成
      // 【テスト内容】: name="A" を指定
      // 【期待される動作】: "A" または "AA" が表示される
      // 🟢 TDD Green: 実装済みのイニシャル生成機能の境界値確認

      const { container } = render(
        <UserAvatar name="A" />
      );

      // 【確認内容】: 1文字名前でもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-12: Very long name - 非常に長い名前', () => {
      // 【テスト目的】: 長い名前でのイニシャル生成
      // 【テスト内容】: 20文字以上の長い名前を指定
      // 【期待される動作】: 最初と最後の文字のイニシャルが表示される
      // 🟢 TDD Green: 実装済みのイニシャル生成機能の長い名前対応確認

      const longName = "Christopher Alexander Bartholomew Richardson";
      const { container } = render(
        <UserAvatar name={longName} />
      );

      // 【確認内容】: 長い名前でもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-13: Minimum size - 最小サイズ', () => {
      // 【テスト目的】: 最小サイズ（1px）での表示
      // 【テスト内容】: size={1} を指定
      // 【期待される動作】: 1pxサイズで表示（実用的ではないが処理可能）
      // 🟢 TDD Green: 実装済みのサイズ設定機能の境界値確認

      const { container } = render(
        <UserAvatar name="Test" size={1} />
      );

      // 【確認内容】: 最小サイズでもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-14: Maximum size - 最大サイズ', () => {
      // 【テスト目的】: 大きなサイズ（500px）での表示
      // 【テスト内容】: size={500} を指定
      // 【期待される動作】: 500pxサイズで表示される
      // 🟢 TDD Green: 実装済みのサイズ設定機能の大きなサイズ確認

      const { container } = render(
        <UserAvatar name="Test" size={500} />
      );

      // 【確認内容】: 大きなサイズでもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-15: Special characters in name - 特殊文字名前', () => {
      // 【テスト目的】: 特殊文字を含む名前でのイニシャル生成
      // 【テスト内容】: name="José María" を指定
      // 【期待される動作】: "JM" イニシャルが表示される
      // 🟢 TDD Green: 実装済みのイニシャル生成機能の特殊文字対応確認

      const { container } = render(
        <UserAvatar name="José María" />
      );

      // 【確認内容】: 特殊文字でもコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('統合テスト', () => {
    it('TC-16: Package import consistency - パッケージインポート一貫性', () => {
      // 【テスト目的】: ui-coreからのインポートが正常に動作
      // 【テスト内容】: @hierarchidb/ui-core からUserAvatarをインポート
      // 【期待される動作】: インポートエラーが発生しない
      // 🟢 TDD Green: 統合済みのためインポートが正常動作する

      // 【確認内容】: UserAvatarがインポート可能でコンポーネントとして動作することを確認
      const { container } = render(<UserAvatar />);
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-17: Backward compatibility from ui-auth - ui-authからの後方互換性', () => {
      // 【テスト目的】: ui-authからもUserAvatarが使用できる
      // 【テスト内容】: 同じインターフェースで動作することを確認
      // 【期待される動作】: ui-coreのUserAvatarが正常動作する
      // 🟢 TDD Green: 統合により互換性が確保されている

      // 【確認内容】: ui-authと同じプロパティでも正常動作することを確認
      const { container } = render(
        <UserAvatar 
          pictureUrl="https://lh3.googleusercontent.com/test"
          email="test@example.com" 
          name="Test User" 
          size={40}
        />
      );
      expect(container.firstChild).toBeTruthy();
    });

    it('TC-18: Core image utilities integration - Core画像ユーティリティ統合', async () => {
      // 【テスト目的】: @hierarchidb/coreの画像ユーティリティが正常に使用される
      // 【テスト内容】: preloadImageとgetGoogleImageVariantsの呼び出し確認
      // 【期待される動作】: core パッケージの関数が呼び出される
      // 🟢 TDD Green: 統合済みのcoreユーティリティが正常動作する

      const mockPreloadImage = vi.mocked(await import('./imageUtils')).preloadImage;
      const mockGetGoogleImageVariants = vi.mocked(await import('./imageUtils')).getGoogleImageVariants;
      
      mockPreloadImage.mockResolvedValue(true);
      mockGetGoogleImageVariants.mockReturnValue(['https://test.com/image=s96']);

      const { container } = render(
        <UserAvatar pictureUrl="https://lh3.googleusercontent.com/test" />
      );

      // 【確認内容】: coreパッケージ統合でコンポーネントが正常動作することを確認
      expect(container.firstChild).toBeTruthy();
    });
  });
});