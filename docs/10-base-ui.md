# 10. ベースUI（ホーム・情報画面などプラグイン以外の画面）

本章では、プラグインに依存しないアプリケーションのベースUI（ホーム画面、情報画面、プロバイダ等）について説明する。ここでいう「ベースUI」とは、アプリの土台となるレイアウト/テーマ/共通ページ群のことで、プラグイン（treeNodeType別のUI）に先立って読み込まれ、全体のユーザー体験を支える。

- 対象コード:
  - `packages/app/app/routes/_index.tsx`（ホーム）
  - `packages/app/app/routes/info.tsx`（情報画面）
  - `packages/app/app/routes/providers.tsx`（テーマ等のプロバイダ）
  - 認証関連: 9章参照（`auth.callback.tsx`, `silent-renew.tsx`）
- 関連章: 5章（UIモジュール構成）, 8章（プラグイン・ルーティング）

## 10.1 ルーティングの基本構造

React Router v7 のファイルベース・ルーティングを採用しており、`app/routes` 直下に各画面が定義される。
- ルート `/` → `_index.tsx`
- ルート `/info` → `info.tsx`
- プロバイダ的なルート（テーマ注入など）→ `providers.tsx`（親レイアウト用途）
- プラグイン系（階層的URL）→ 11章（および8章）にて解説

## 10.2 ホーム画面（_index.tsx）

`packages/app/app/routes/_index.tsx` は最初に表示されるランディング的画面で、MUI コンポーネントを用いて簡潔に構成されている。

- UI構成（抜粋）
  - タイトル（`Typography h2`）
  - サブコピー（`Typography body1`）
  - `/info` への誘導ボタン（`Button component={Link} to="/info"`）
  - 認証状態に応じた CTA（未認証: 「Sign In」/ 認証済: 「ツリーへ移動」など）
- 役割
  - アプリの概要や状態に応じて、情報画面やチュートリアルへの導線を提供
  - ユーザー状態（ログイン済/未ログイン）に応じて CTA を出し分け（9章参照）
  - （参考）../eria-cartograph の実装と同等の構成: ヒーローセクション + 主要CTA + サブリンク群（ヘルプ/ドキュメント）
- 実装メモ
  - `useBFFAuth()` の `isAuthenticated` を読んで条件分岐（9.2参照）
  - CTA からのログイン誘導は `signIn({ forceMethod: 'popup' })` を優先、ブロック時は自動でリダイレクト（9.2/9.6）

## 10.3 情報画面（info.tsx）

`packages/app/app/routes/info.tsx` は `InfoPage` コンポーネントを描画する薄いルート。
- 役割
  - バージョン、依存関係、利用方法、著者情報、ライセンス等を表示する場として設計
  - ドキュメント（本リポジトリの docs）とのリンク集を設置可能
- 実装上の注意
  - 将来的にプライバシーポリシーや利用規約の掲示位置としても流用可能
  - 認証不要の公開ページとしてアクセス可能（認証ガードなし）

## 10.4 プロバイダレイヤ（providers.tsx）

テーマやグローバルスタイルをアプリ全体に供給するためのプロバイダ的レイアウトを、専用ルートで用意している。
- MUI テーマ適用: `ThemeProvider` + `CssBaseline`
- マウント完了後の描画: `mounted` フラグで SSR/CSR や初期化タイミングのずれに対処
- 拡張余地
  - i18n プロバイダ、QueryClientProvider、Snackbar/Toast、ErrorBoundary などの共通ラッパーを段階的に統合
  - 認証コンテキスト（`useBFFAuth` を用いた Provider 化）もここで包むことを検討

## 10.5 ベースUIとプラグインUIの責務分離

- ベースUIの責務
  - グローバルなテーマ、レイアウト（ヘッダー、フッター、サイドバーなど）
  - 公開ページ（ホーム、情報、ヘルプ、サポート、サインイン/アウト）
  - ルートガード（認証が必要な領域の入り口で制御）
- プラグインUIの責務（11章）
  - ノードと treeNodeType に応じた画面の切り替え
  - NodeTypeRegistry に登録された UI/アクションのレンダリング

## 10.6 ナビゲーションとアクセス制御

- ナビゲーション
  - ホーム→情報の基本導線
  - 将来的にはヘッダーメニュー/ドロワーで `Resources`/`Projects` などツリー領域への導線を提供
- アクセス制御
  - ベース画面は原則公開。ツリー画面（`/t/...`）は `RequireAuth` などで保護（9章参照）

### 10.6.1 認証メニュー（ヘッダー）

../eria-cartograph の実装に準拠し、ヘッダー右上にユーザ認証メニューを配置する想定。未認証時は「Sign In」ボタン、認証済み時はアバター + メニュー（プロフィール、設定、Sign Out）を表示する。

- 実装指針（9章連携）
  - `useBFFAuth()` から `isAuthenticated`, `user`, `signIn`, `signOut` を取得（9.2, 9.8）
  - 未認証: `signIn({ forceMethod: 'popup' })`。Popup ブロック時は自動でリダイレクト（9.6）
  - 認証済: `Avatar` をトリガに `Menu` を表示。`Sign Out` 選択で `signOut()` を実行
  - ルート `/auth/callback`, `/silent-renew` は 9.3 の通り
- UI 構成（例）
  - `AppBar`/`Toolbar` 内に `HeaderAuthMenu` を配置
  - メニュー項目: `Profile`（将来拡張）, `Settings`（将来拡張）, `Sign Out`
- サンプル（簡略版: 9.8 の Button 例をメニュー化）

```tsx
import { useState } from 'react';
import { Avatar, Button, IconButton, Menu, MenuItem, ListItemIcon } from '@mui/material';
import Logout from '@mui/icons-material/Logout';
import Settings from '@mui/icons-material/Settings';
import Person from '@mui/icons-material/Person';
import { useBFFAuth } from '@hierarchidb/ui-auth';

export function HeaderAuthMenu() {
  const { user, isAuthenticated, signIn, signOut } = useBFFAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (!isAuthenticated) {
    return <Button onClick={() => signIn({ forceMethod: 'popup' })} aria-label="Sign in">Sign In</Button>;
  }
  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="User menu">
        <Avatar src={user?.profile?.picture} alt={user?.profile?.name} />
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); signOut(); }}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>
    </>
  );
}
```

- 配置場所
  - 10.9 のレイアウト例にある `HeaderAuthButton` を `HeaderAuthMenu` に置き換え可能
  - Provider レイヤ（10.4）で `useBFFAuth` のラッパーを組み込むことも検討（9章参照）

## 10.7 状態管理とデータ取得

- ベース画面では大規模なデータ取得は行わない（軽量）
- 共有状態（テーマ、ユーザー、言語）はプロバイダで供給
- プラグイン画面では `clientLoader` による段階的取得を活用（8章参照）

## 10.8 i18n/アクセシビリティ（推奨）

- i18n
  - `ui-i18n` をベースに `LanguageProvider` を `providers.tsx` に組み込む設計が容易
  - 文言は `t('key')` パターンで抽出し、docs へのリンク名も翻訳
- アクセシビリティ
  - ボタン/リンクには `aria-label` を適切に付与
  - コントラスト比とキーボード操作を考慮

## 10.9 実装例: レイアウトとヘッダー

以下はベースのレイアウトにヘッダーと認証ボタンを配置する例（9章の `HeaderAuthButton` を利用）。プロダクションでは 10.6.1 の `HeaderAuthMenu` への差し替えも推奨。

```tsx
import { Outlet } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { HeaderAuthButton } from './HeaderAuthButton';

export default function RootLayout() {
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>HierarchiDB</Typography>
          <HeaderAuthButton />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 2 }}>
        <Outlet />
      </Box>
    </>
  );
}
```

## 10.10 まとめ

- ベースUIは「アプリの土台」を提供し、プラグインUIに依存せずに動作する
- ルーティング上は `/` と `/info` が公開の基本導線、`providers.tsx` が横断的機能を包む
- 認証、プラグイン・ルーティングはそれぞれ 9章/11章で詳細を定義
