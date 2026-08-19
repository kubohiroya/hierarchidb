# OAuth authenticated UI session contract

最終更新: 2026-08-19

## 目的

OAuth callback または token refresh が成功した後に、UI が認証済み状態を保存・通知・復元する
契約を一意に定める。callback の HTTP 成功と UI の認証済み状態を別々に成功扱いしてはならない。

## SSOT

- 契約検証・保存・復元: `packages/ui/auth/src/services/AuthSessionStorage.ts`
- BFF callback / refresh client: `packages/ui/auth/src/services/BFFAuthService.ts`
- React hook consumer: `packages/ui/auth/src/hooks/useAuth.ts`
- app root provider consumer: `packages/ui/auth/src/contexts/useSimpleBFFAuthProvider.ts`

`BFFAuthService` と `SimpleBFFAuthProvider` は token 応答や保存済み userinfo を独自に解釈せず、
必ず `AuthSessionStorage` を使用する。

## BFF token response contract

`/auth/token` と成功した `/auth/refresh` の UI 必須 subset は次のとおり。

```json
{
  "access_token": "non-empty session JWT",
  "expires_in": 86400,
  "userinfo": {
    "sub": "non-empty provider user ID",
    "email": "non-empty email",
    "name": "non-empty display name",
    "picture": "optional non-empty URL"
  },
  "refresh_token_id": "optional non-empty opaque ID"
}
```

- `access_token` は非空文字列でなければならない。
- `expires_in` は正の有限数（秒）でなければならない。
- `userinfo` は object で、`sub`、`email`、`name` は非空文字列でなければならない。
- `picture` と `refresh_token_id` は省略可能だが、存在する場合は非空文字列でなければならない。
- provider は token response から補完しない。認証開始時に保存した `auth_provider` を callback が
  必須入力として使用し、refresh は保存済み session の provider を使用する。
- `id_token` を `access_token` の代替として使用しない。`expires_in`、userinfo、provider に既定値を
  与えない。

契約違反は callback error として失敗させ、認証成功画面や成功後 navigation に進めない。

## Persistence contract

token response 全体を検証した後、次を同一の session として `localStorage` に保存する。

| key | value |
| --- | --- |
| `access_token` | 検証済み session JWT |
| `userinfo` | `id`、`email`、`name`、任意の `picture`、`provider`、絶対時刻 `expires_at` |
| `refresh_token_id` | 応答に存在する場合だけ保存する |

`access_token` と `userinfo` の片方だけが存在する状態は無効である。保存処理が失敗した場合は部分的な
session を削除し、成功として継続しない。reload 時も同じ必須値を再検証し、JWT payload 解析や既定値
補完へ fallback しない。

## State propagation contract

保存完了後、同一 document に `hierarchidb:auth-session-changed` event を dispatch する。
`useBFFAuthService` と `SimpleBFFAuthProvider` はこの event を購読し、保存済み session を再読込する。
別タブ・別 window からの変更は標準の `storage` event で同期する。

session clear 後も同じ custom event を dispatch し、全 consumer が unauthenticated 状態へ遷移する。

## Responsibility boundary

- callback 後の return URL 解決は `docs/auth-callback-routing-spec.md` の責務とする。
- callback 画面からの離脱、navigation timeout、hard redirect は Issue #818 の責務とする。
- BFF provider token exchange、session JWT 発行、KV 保存は backend BFF の責務とする。

## 検証

- 正常応答を保存し、custom event を通知する。
- `access_token`、`expires_in`、必須 userinfo が欠ける応答を拒否し、session を保存しない。
- 保存済み session を reload 相当で復元する。
- callback の token exchange が不完全な成功応答を受けた場合、明示的な callback error にする。
- `pnpm -w turbo run test --filter @hierarchidb/ui-auth`
- `pnpm -w turbo run typecheck --filter @hierarchidb/ui-auth`
- `pnpm -w turbo run typecheck --filter @hierarchidb/app`
- `pnpm -w turbo run build --filter @hierarchidb/app`

## Rollback

Issue #1259 の変更を revert する。旧 optional contract や `id_token` fallback を併設する切替フラグは
設けない。
