@hierarchidb/auth-recovery
==========================

認証失敗(401)時の復帰フローを共通化する feature。UI と Worker/Feature 間を AuthNotificationRegistry で接続し、トークン更新→自動再試行までを一元化します。

目的
----
- 各プラグインで散在していた「401→UI誘導→再試行」処理を共通化。
- HTTP 経路を `fetchWithAuth()` に置き換えるだけで復帰フローを利用可能に。
- 既存の React 側の通知/復帰実装（Rect 文脈の実装）をそのまま再利用。

アーキテクチャ
--------------
- Facade: `AuthRecoveryService`
  - `setToken(token, type?, expiresAt?)`
  - `getAuthHeaders()` → `{ Authorization: 'Bearer <token>' }` など
  - `fetchWithAuth(url, init?, ctx?)` → 401 のとき `AuthRequired` 通知を発行し、UI の成功通知後に自動再試行
- 通知面: `@hierarchidb/common-auth` の `AuthNotificationRegistry`
  - Worker/Feature → `AuthRequired`
  - UI → `AuthSuccess` / `AuthCancelled`

導入手順（最小）
----------------
1) UI でトークンを Worker に同期（ログイン/更新時）
```ts
import { setShapeAuthToken } from '@hierarchidb/shape-plugin/ui';

// 例: サインイン/リフレッシュ後
await setShapeAuthToken(auth.token, 'Bearer', auth.expiresAt);
```

2) Feature 側の HTTP 経路を `fetchWithAuth` に置換
```ts
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

const auth = await AuthRecoveryService.getSingleton();
const res = await auth.fetchWithAuth(url, { method: 'GET' }, { pluginType: 'shape' });
```

3) UI 側で `AuthNotificationRegistry` ハンドラを登録（既存の実装を流用）
- `AuthRequired` を受け取ったら UI でログイン/同意フローを表示
- トークン取得後 `AuthSuccess` を発火（requestId と新トークンを返す）

API（概要）
-----------
```ts
class AuthRecoveryService {
  static getSingleton(): Promise<AuthRecoveryService>
  setToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): void
  getAuthHeaders(): Record<string, string>
  fetchWithAuth(
    url: string,
    init?: RequestInit,
    ctx?: { sessionId?: string; pluginType?: 'shape' | 'spreadsheet' | 'styler' | 'generic'; maxRetries?: number }
  ): Promise<Response>
}
```

利用上の注意
------------
- UI 側の `AuthSuccess`/`AuthCancelled` 通知が来ない場合、`DEFAULT_TIMEOUT` 経過で `fetchWithAuth` は失敗します。
- `setToken()` を事前に呼んでおけば、多くの経路で 401 を避けられます。
- 既定のリトライ回数は `@hierarchidb/common-auth` の定数に従います（必要に応じて `ctx.maxRetries` で上書き）。

shape との統合例
----------------
- ダウンロード経路は `createShapeDownloadService()` で `Authorization` ヘッダを注入済み。
- データソース（GADM / GeoBoundaries / NaturalEarth / OSM）は `authFetch()` に置換済み。

今後の計画
----------
- 任意の `NetworkPort` 実装へミドルウェアとして差し込めるヘルパを追加（download には `createAuthAwareNetworkPort` を提供済み）。
- 失敗理由の詳細分類（CORS, 429, ネットワーク断）と UI 表示の標準化。
- e2e（401→通知→成功通知→自動再試行）のサンプル追加。

