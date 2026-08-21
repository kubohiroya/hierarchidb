# OAuth authenticated UI session contract

最終更新: 2026-08-21

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

## Provider selection and propagation contract

provider選択UIは、ユーザーが選択した `google | github | microsoft` を認証開始処理へ必須値として
渡す。認証開始処理は同じproviderをauthorize endpointのpathと `auth_provider` の両方に使用する。

provider引数の欠落、空文字列、未知値をGoogleとして補完してはならない。認証redirectを開始する前に
契約違反として失敗させる。callbackのtoken exchangeは、認証開始時に保存した同じ
`auth_provider` をBFF requestへ渡す。

この契約はprovider dialog、認証必須dialog、明示的なlogin routeから開始する全BFF OAuth flowに
適用する。

## BFF token response contract

`/auth/token` と成功した `/auth/refresh` の UI 必須 subset は次のとおり。

```json
{
  "access_token": "non-empty session JWT",
  "expires_in": 14400,
  "session_mode": "persistent",
  "userinfo": {
    "sub": "non-empty provider user ID",
    "email": "non-empty email",
    "name": "non-empty display name",
    "picture": "optional non-empty URL"
  },
  "refresh_token_id": "non-empty opaque ID in persistent mode"
}
```

- `access_token` は非空文字列でなければならない。
- `expires_in` は正の有限数（秒）でなければならない。
- `session_mode` は `persistent | stateless` のどちらかでなければならない。
- `userinfo` は object で、`sub`、`email`、`name` は非空文字列でなければならない。
- `picture` は省略可能だが、存在する場合は非空文字列でなければならない。
- `persistent` 応答には非空の `refresh_token_id` が必須である。`stateless` 応答に
  `refresh_token_id` を含めてはならない。
- provider は token response から補完しない。認証開始時に保存した `auth_provider` を callback が
  必須入力として使用し、refresh は保存済み session の provider を使用する。
- `id_token` を `access_token` の代替として使用しない。`expires_in`、userinfo、provider に既定値を
  与えない。

契約違反は callback error として失敗させ、認証成功画面や成功後 navigation に進めない。

## BFF session mode contract

BFFの設定 `AUTH_SESSION_MODE` は `persistent | stateless` の必須値である。bindingの有無から
運用意図を推測してはならない。

| 設定mode | `AUTH_KV` | token refresh | JWT期限後 | 通常時のKV警告 |
| --- | --- | --- | --- | --- |
| `persistent` | session保存、refresh、revokeに使用 | 使用する | KV sessionから更新 | なし |
| `stateless` | 使用しない | 使用しない | sessionを削除し再ログイン | なし |

`SESSION_DURATION_HOURS` は必須の正整数であり、欠落または不正値を既定値で補完しない。
repositoryのchecked-in設定は4時間とする。`stateless` は開発中、運用準備中、またはKVを利用しない
正式運用として選択でき、`AUTH_KV` が未bindingでも障害ではない。

token応答の `session_mode` は、そのtokenが実際にrefresh可能かを表す。`persistent` loginでKV保存に
失敗して短命JWTだけを返す場合は、設定modeにかかわらず応答を `session_mode=stateless` とし、後述の
KV警告を付ける。UIは `session_mode=stateless` のtokenに対して `/auth/refresh` を呼ばない。

`stateless` modeで `/auth/refresh` が直接呼ばれた場合、BFFはHTTP 401
`reauthentication_required` を警告なしで返し、tokenを発行しない。revoke/logoutは端末内のsession
終了として完了し、KV警告を返さない。

## BFF KV warning contract

BFFは `AUTH_SESSION_MODE=persistent` のときだけCloudflare Workers KVを `AUTH_KV` bindingとして
使用する。このmodeで未bindingまたはKV操作失敗が発生した場合、意図した `stateless` 運用と混同せず
警告を返す。`AUTH_SESSION_MODE=stateless` では `AUTH_KV` の有無にかかわらずKV警告を返さない。

BFF応答の任意の `warning` fieldは、次の完全な契約を満たす場合だけKV警告として扱う。

```json
{
  "code": "kv_unavailable",
  "operation": "refresh",
  "action": "relogin",
  "reason": "missing_kv"
}
```

- `code` は `kv_unavailable` だけを許可する。
- `operation` は `login | refresh | revoke | logout` だけを許可する。
- `action` は `none | relogin` だけを許可する。
- `reason` は `missing_kv | kv_error` だけを許可する。
- field欠落、型違反、未知の文字列を警告として受理しない。

有効な警告を受信したUIは `hierarchidb:bff-warning` eventを発行し、警告dialogを表示する。
refreshの警告では新しいtokenを保存せず、そのBFF client instanceのrefreshを停止する。次に成功した
login/token exchangeが完了するまで、refreshを暗黙に再試行してはならない。

警告dialogは原因や復旧時刻を推測しない。quota resetの固定時刻を表示してはならない。

login、revoke、logoutの縮退動作と `AUTH_KV` の作成・検証・ロールバックは
`packages/backend/bff/docs/auth-kv-operations.md` をSSOTとする。

## Callback replacement and idempotency contract

有効な `pkce_code_verifier` と `auth_provider` が存在する callback は、新しい認証 flow として
必ず authorization code を交換する。保存済み session が存在しても、その session を返して code
exchange を省略してはならない。これにより、旧形式・部分保存・期限切れの session が新しい認証を
阻害せず、account switch も新しい token response で確定する。

同じ authorization code の同時処理は、code ごとの単一 Promise を共有して重複 exchange を防ぐ。
callback の再描画または reload で PKCE verifier が既に削除されている場合に限り、完全な保存済み
session を再利用できる。保存済み session が契約違反なら例外にし、削除、field merge、JWT解析、
既定値補完で処理を継続しない。

新しい token response の検証と保存が成功した場合だけ、保存済み session 全体を置き換える。

## Persistence contract

token response 全体を検証した後、次を同一の session として `localStorage` に保存する。

| key | value |
| --- | --- |
| `access_token` | 検証済み session JWT |
| `userinfo` | `id`、`email`、`name`、任意の `picture`、`provider`、絶対時刻 `expires_at`、`session_mode` |
| `refresh_token_id` | `persistent` の場合だけ必須で保存し、`stateless` では削除する |

`access_token` と `userinfo` の片方だけが存在する状態は無効である。保存処理が失敗した場合は部分的な
session を削除し、成功として継続しない。reload 時も同じ必須値を再検証し、JWT payload 解析や既定値
補完へ fallback しない。

## State propagation contract

保存完了後、同一 document に `hierarchidb:auth-session-changed` event を dispatch する。
`useBFFAuthService` と `SimpleBFFAuthProvider` はこの event を購読し、保存済み session を再読込する。
`WorkerProvider` も同eventを購読し、prepare済みの同一canonical clientへread-only bridgeを再登録して、
保存完了後の完全sessionをSharedWorker側で再検証する。
別タブ・別 window からの変更は標準の `storage` event で同期する。

session clear 後も同じ custom event を dispatch し、全 consumer が unauthenticated 状態へ遷移する。

## UI to worker token bridge contract

`AuthSessionStorage` は UI session の唯一の検証・永続化境界である。SharedWorker または dedicated
worker は `localStorage` を直接読まず、UI が提供する storage bridge から現在の session token を
取得する。

- bridge は `AuthSessionStorage.load()` が完全な session として検証した `access_token` だけを返す。
- `token_expires_at` は検証済み `userinfo.expires_at` を秒単位へ変換した値とする。JWT payload の解析や
  独立した legacy key による補完を bridge の正規経路にしない。
- session が完全に存在しない場合だけ `null` を返す。部分保存、JSON破損、storage access failureは
  bridge登録またはtoken取得の失敗として伝播させる。
- worker client は bridge の登録と初回session検証が完了するまで ready として公開しない。
- 同一documentでsession変更eventを受けたworker clientは、単独tokenを書き込まず、read-only bridgeを
  再登録して完全sessionを再検証する。
- SharedWorkerへのbridge登録が競合した場合、失敗した登録は、登録開始前または後から検証に成功した
  現行bridgeを未登録状態へ戻してはならない。
- session変更eventによるbridge再登録はevent順に直列化する。先行登録が失敗しても、後続の明示eventは
  そのrejectを結果として引き継がず、自身の完全sessionを新しいbridgeで検証する。後続登録が成功した
  場合は、先行失敗によるWorkerProviderのerror状態を解除する。
- ready公開後のbridge再登録が失敗した場合、WorkerProviderは失敗を隠蔽せず、空画面にもせず、理由と
  retry/reload操作を持つterminal overlayを表示する。
- query付きURLで起動するSharedWorker entryを、worker内の動的chunkからqueryなしのURLで再importしては
  ならない。auth bridgeと`AuthService` singletonを含む共有moduleは副作用を持つSharedWorker entryとは
  別のneutral chunkへ出力し、entryと動的chunkが同一module URLを参照しなければならない。production
  buildは、entry以外のworker artifactが`shared-worker.js`をimportしないことを検証する。
- Worker API は単独tokenの注入・書込APIを公開しない。UIは完全なsessionを保存してから
  `AUTH_SUCCESS` を通知し、workerはread-only bridgeから再読込する。
- worker側からのsession clearは `AuthSessionStorage.clear()` を通じて `access_token`、`userinfo`、
  `refresh_token_id` を一体として削除し、変更eventを通知する。
- SharedWorker内部のAPIをtoken取得元として再呼び出す経路や、callback未登録時の互換fallbackを
  設けない。

この契約は現行Bearer方式のworker連携に限定する。cookie、reverse proxy、domain、BFF routingを含む
将来のtransport選択は Issue #1316 の責務とする。

## Responsibility boundary

- callback 後の return URL 解決は `docs/auth-callback-routing-spec.md` の責務とする。
- callback 画面からの離脱、navigation timeout、hard redirect は Issue #818 の責務とする。
- BFF provider token exchange、session JWT 発行、KV 保存は backend BFF の責務とする。
- 通常のPlaywright E2EにおけるOAuth/BFF境界のmock方法は
  `docs/e2e-authentication-spec.md` の責務とする。

## 検証

- 正常応答を保存し、custom event を通知する。
- `access_token`、`expires_in`、必須 userinfo が欠ける応答を拒否し、session を保存しない。
- 保存済み session を reload 相当で復元する。
- 旧形式または部分保存 session が存在しても、active PKCE callback は新しい code を交換し、検証済み
  session 全体で置き換える。
- app root が使用する `SimpleBFFAuthProvider` が同一タブ通知と reload の両方で認証済みになる。
- callback の token exchange が不完全な成功応答を受けた場合、明示的な callback error にする。
- 許可された全KV警告を受理し、未知の `operation`、`action`、`reason` を拒否する。
- refreshのKV警告受信後はtokenを置換せず、次の成功したloginまでrefreshを停止する。
- `persistent` 応答は `refresh_token_id` を必須とし、`stateless` 応答では禁止する。
- `stateless` sessionは期限前にrefreshせず、期限切れ時にlocal sessionを削除する。
- `stateless` modeのlogin/revoke/logoutではKV警告を表示しない。
- 完全な保存済みsessionだけがworker bridgeからtokenとして取得できる。
- worker bridge登録、storage access、session検証の失敗時にworker clientをreadyとして公開しない。
- canonical Playwright fixtureが製品のlogin UI、PKCE authorize、callback、token exchange、session保存、
  React consumerを通して認証済みUIへ遷移する。
- auth-required E2Eはsessionを直接書き込まず、同じcanonical fixtureを使用する。
- `pnpm -w turbo run test --filter @hierarchidb/ui-auth`
- `pnpm -w turbo run typecheck --filter @hierarchidb/ui-auth`
- `pnpm -w turbo run typecheck --filter @hierarchidb/app`
- `pnpm -w turbo run build --filter @hierarchidb/app`

## Rollback

Issue #1259 の変更を revert する。旧 optional contract や `id_token` fallback を併設する切替フラグは
設けない。
