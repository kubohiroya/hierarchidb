## 8.2 SPAとしてのuseBFFAuthを用いた認証機能

本章では、hierarchidb の SPA（Single Page Application）における認証の実装方針と、その中心となる `@hierarchidb/ui-auth` の `useBFFAuth` フックを用いた統合的な認証処理について、現状のコードベースと推測できる設計方針をもとに詳述する。

- 想定環境: フロントエンドは React + React Router v7 構成、UIはMUI。BFF（Backends For Frontends）は Cloudflare Workers 上にデプロイ。
- 関連実装: `packages/ui-auth/src/hooks/useBFFAuth.ts`、`packages/app/app/routes/auth.callback.tsx`、`packages/app/app/routes/silent-renew.tsx`
- 関連章: 5章（ベースモジュール）bff/cors-proxy、7章（AOPアーキテクチャ）、8章（プラグイン・ルーティング）

### 8.2.1 概要

SPA 側は `useBFFAuth` によって、以下を一元的に扱う:
- 認証状態の取得（`isAuthenticated`, `isLoading`, `user`）
- ログイン・ログアウト（`signIn`, `signOut`）
- トークン管理（`getIdToken`, `getAccessToken`, 自動リフレッシュ）
- リダイレクト復帰（`resumeAfterSignIn`）
- 既存 OIDC ライブラリ互換な `auth` オブジェクト（`signinRedirect`, `signinPopup`, など）

BFF は、OAuth2/OIDC プロバイダーとのやり取り（認証開始、コールバック処理、トークン保管と更新）を担い、SPA からは `/api/auth/*` エンドポイント経由で操作される（コード内ではモック実装も含まれる）。

### 8.2.2 useBFFAuth のAPIと内部構造（現状コード）

`packages/ui-auth/src/hooks/useBFFAuth.ts` より抽出:
- コア状態
  - `isAuthenticated: boolean`: `user` と `expires_at` に基づく
  - `isLoading: boolean`: BFF呼び出し中や更新中
  - `user: { profile, access_token, refresh_token, expires_at } | null`
- 主要メソッド
  - `signIn(options)`: `popup`/`redirect` の両方式に対応。ポップアップ検出（`PopupDetectionService`）により自動選択し、ブロック時はリダイレクトにフォールバック
  - `signOut()`: ローカル状態とタイマーをクリアし、`/` などホームへ遷移
  - `resumeAfterSignIn(defaultRedirect)`: 認証成功後、保存済みの `redirectUrl` に戻す
  - `getIdToken()`: CORS プロキシ等で利用する ID Token を取得（実装上は `access_token` を共用）
  - `refreshToken()`: `/api/auth/refresh` を叩いてトークン更新
- 自動リフレッシュ
  - `expires_at` の 5 分前（定数 `TOKEN_REFRESH_BUFFER`）に更新を予約し、必要に応じて即時更新を実施
- BFF想定エンドポイント（現状モック相当）
  - `POST /api/auth/signin`（signin開始: popup/redirect, provider選択）
  - `POST /api/auth/signout`（サインアウト）
  - `POST /api/auth/refresh`（トークン更新: cookieベース）

互換目的の `auth` オブジェクトを併せて返すため、既存の OIDC コンポーネントと組み合わせやすい設計である。

### 8.2.3 画面フローとルーティング

- 認証開始（UI任意のボタン）
  - `useBFFAuth().signIn({ provider, forceMethod?: 'popup'|'redirect' })`
  - Popup がブロックされたら自動で Redirect にフォールバック
- 認証コールバック
  - ルート: `/auth/callback`
  - 実装: `packages/app/app/routes/auth.callback.tsx`
  - `AuthCallbackHandler.handleCallback()` を呼び、`sessionStorage('auth.returnUrl')` に基づいて元画面へ `navigate()`
- サイレントリニューアル
  - ルート: `/silent-renew`
  - 実装: `packages/app/app/routes/silent-renew.tsx`
  - IFrame でロードされ、`resumeAfterSignIn()` を呼び出し、親ウィンドウへ `postMessage` で成功/失敗を通知

ホーム・情報ページ等のベース画面については 10章を参照。

### 8.2.4 ガードと遷移制御の実装例

典型的には「保護ルート」に入る手前で、認証状態に応じてガードする。

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useBFFAuth } from '@hierarchidb/ui-auth';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, signIn } = useBFFAuth();
  const location = useLocation();

  if (isLoading) return null; // スピナー等

  if (!isAuthenticated) {
    // 現在地を保存してログインへ
    signIn({ returnUrl: location.pathname + location.search, forceMethod: 'redirect' });
    return <Navigate to="/" replace />; // UI/UXに応じて
  }
  return children;
}
```

React Router v7 のファイルルートと組み合わせる場合、保護対象の層（例: `/t/...` の配下）でラップする。

### 8.2.5 トークンとセキュリティ

- フロント側は ID/Access トークンを localStorage と HTTP-only Cookie のハイブリッドで扱う設計（実装は環境に合わせて微調整）
- BFF 側はプロバイダの `refresh_token` を安全に保管し、`/refresh` 経由で Access Token を短命更新
- CORS Proxy 利用時は `getIdToken()` をヘッダ付与（例: `Authorization: Bearer <token>`）し、BFF で検証
- 失効検出: `expires_at` を監視し、バッファ内に入ったら自動更新、失敗時は `signIn()` を促す

### 8.2.6 エラーハンドリング

- Popup ブロック: `popupDetection` により記憶し、以後は redirect を既定化
- Refresh 失敗: ダイアログで再認証を促し、復帰 URL を保存した上で `signIn()`
- Callback 失敗: `/auth/callback` でメッセージ表示 + Home へのリンク（実装済）

### 8.2.7 複数プロバイダ対応

`AuthProviderType` により `google`/`microsoft`/`github` などを識別。`signIn({ provider: 'google' })` のように指定可能。BFF 側でのルーティング（/api/auth/signin?provider=...）と一致させる。

### 8.2.8 サンプル: ヘッダーのログインUI

```tsx
import { useBFFAuth } from '@hierarchidb/ui-auth';
import { Button, Avatar } from '@mui/material';

export function HeaderAuthButton() {
  const { user, isAuthenticated, signIn, signOut } = useBFFAuth();

  if (!isAuthenticated) {
    return <Button onClick={() => signIn({ forceMethod: 'popup' })}>Sign In</Button>;
  }
  return (
    <Button onClick={() => signOut()} startIcon={<Avatar src={user?.profile.picture} />}>Sign Out</Button>
  );
}
```

### 8.2.9 環境設定（推奨）

- `.env`: 非機密（クライアントID、Callback URL、BFFのベースURL 等）
- Cloudflare Secrets: 機密（クライアントシークレット、署名鍵、KVバインド）
- ルート設定: `/auth/callback`, `/silent-renew` はアプリに存在（app/routes配下に実装済み）

### 8.2.10 既存モジュールとの関係

- 5章: `bff`/`cors-proxy` の方針と整合。`getIdToken()` で CORS Proxy と連携
- 8章: `/t/:treeId/...` の保護は `RequireAuth` をルートレイアウトに適用することで実現

### 8.2.11 認証メニュー（ヘッダー）

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
