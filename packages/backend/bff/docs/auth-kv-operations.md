# BFF `AUTH_KV` 運用仕様

最終更新: 2026-08-20

## 目的

HierarchiDB BFF がCloudflare Workers KVを認証セッション保存に使用する `persistent` modeと、
KVを使用せず短命JWTの期限後に再ログインする `stateless` modeの設定、検証、障害時動作、
ロールバック手順を定める。BFFが参照するbinding名は `AUTH_KV` のみとし、旧文書にある
`RATE_LIMIT_KV`、`AUDIT_LOG_KV`、`SESSION_KV` は現行認証実装のbindingではない。

## SSOT

- 本番設定: [`wrangler.hierarchidb.toml`](../wrangler.hierarchidb.toml)
- binding型: [`types.ts`](../src/types.ts)、[`env-mapper.ts`](../src/env-mapper.ts)
- 保存形式とTTL: [`kv-storage.ts`](../src/utils/kv-storage.ts)
- login/token exchange: [`callback.ts`](../src/auth/callback.ts)
- refresh/revoke: [`refresh.ts`](../src/auth/refresh.ts)
- logout: [`index.ts`](../src/index.ts)
- UIセッション契約: [`auth-session-contract.md`](../../../../docs/auth-session-contract.md)

namespace IDは環境固有値であり、この文書へ複製しない。デプロイ時は対象環境のWrangler設定を
SSOTとして確認する。

## session mode

`AUTH_SESSION_MODE` は次のどちらかを必ず明示する。bindingの有無をmode判定に使用しない。

| mode | 用途 | `AUTH_KV` | JWT期限後 | 警告 |
| --- | --- | --- | --- | --- |
| `persistent` | KVを準備した通常運用 | 必須 | refresh可能 | KV未設定・操作失敗時だけ表示 |
| `stateless` | 開発中、運用準備中、KVを使用しない運用 | 使用しない | local sessionを終了し再ログイン | 表示しない |

`SESSION_DURATION_HOURS` も必須の正整数である。checked-in設定は4時間とし、未設定または不正値を
暗黙の24時間などへ補完しない。運用上別の期限を採用する場合は、セキュリティ影響と再ログイン頻度を
確認して対象環境へ明示する。

```toml
[env.development.vars]
AUTH_SESSION_MODE = "stateless"
SESSION_DURATION_HOURS = "4"

[env.production.vars]
AUTH_SESSION_MODE = "persistent"
SESSION_DURATION_HOURS = "4"
```

`stateless` modeでは `AUTH_KV` bindingが存在しても参照しない。これは障害時fallbackではなく、
短命JWTだけを使用する正式な運用形態である。

## 保存データ

`AUTH_KV` は次の2種類のkeyを保存する。

| key prefix | value | TTL |
| --- | --- | --- |
| `user_auth:<userId>` | 暗号化したprovider情報、refresh token情報、session一覧 | refresh token有効期間。現行実装は30日 |
| `session_index:<sessionToken>` | session tokenからuser IDへの索引 | `SESSION_DURATION_HOURS` |

- 暗号鍵は `JWT_SECRET` から導出する。`JWT_SECRET` を変更すると既存の暗号化データを復号できない。
- 1ユーザーあたりの保持session上限は10件である。
- refresh token再利用を検出した場合、そのユーザーの全sessionをrevokeする。
- key名にはuser IDまたはsession tokenが含まれる。key一覧や値をCIログ、Issue、PRへ貼り付けない。

## namespaceの作成

リポジトリの固定Wranglerを使用する。以下は `packages/backend/bff` で実行する。

```bash
pnpm exec wrangler kv namespace create AUTH_KV \
  --config wrangler.hierarchidb.toml \
  --env production

pnpm exec wrangler kv namespace create AUTH_KV \
  --preview \
  --config wrangler.hierarchidb.toml \
  --env production
```

出力された通常用IDとpreview用IDを、対象環境へbindingする。

```toml
[[env.production.kv_namespaces]]
binding = "AUTH_KV"
id = "<production-namespace-id>"
preview_id = "<preview-namespace-id>"
```

developmentを `persistent` modeで運用する場合は、productionとは別のnamespaceを作成する。

```toml
[[env.development.kv_namespaces]]
binding = "AUTH_KV"
id = "<development-namespace-id>"
preview_id = "<development-preview-namespace-id>"
```

production namespaceをdevelopmentと共有してはならない。ローカル開発でKVを使わない場合は
`AUTH_SESSION_MODE=stateless` を明示し、`AUTH_KV`をbindingしない。

## runtime契約

`AUTH_SESSION_MODE=persistent` では完全な認証セッション機能に `AUTH_KV` が必要である。
未bindingまたはKV操作失敗を意図した `stateless` modeとして隠蔽せず、BFFは次の警告を応答へ含める。

```json
{
  "warning": {
    "code": "kv_unavailable",
    "operation": "refresh",
    "action": "relogin",
    "reason": "missing_kv"
  }
}
```

許可値は次のとおり。

- `operation`: `login | refresh | revoke | logout`
- `action`: `none | relogin`
- `reason`: `missing_kv | kv_error`

`missing_kv` は `persistent` modeでのbinding未設定、`kv_error` はbinding後のKV
read/write/delete失敗を表す。quota超過もその他のCloudflare KVエラーも現行BFFでは
`kv_error` であり、応答から原因を細分化しない。

| 操作 | `persistent` + `AUTH_KV` 正常時 | `persistent` + 未bindingまたはKVエラー時 | `stateless` |
| --- | --- | --- | --- |
| login/token exchange | sessionを保存し `session_mode=persistent` とtokenを返す | 保存せず `session_mode=stateless` と `action=none` の警告を返す | `session_mode=stateless` とtokenを警告なしで返す |
| refresh | session検証とtoken rotationを行う | HTTP 503と `action=relogin` の警告を返し、新しいtokenを発行しない | HTTP 401 `reauthentication_required` を警告なしで返す |
| revoke | KV上のユーザーsessionを削除する | HTTP 2xxでローカル完了と `action=none` の警告を返す | HTTP 2xxでローカル完了し、警告を返さない |
| logout | tokenからユーザーを特定し、そのユーザーの全sessionを削除する | HTTP 2xxでローカルlogout完了と `action=none` の警告を返す | HTTP 2xxでローカルlogoutを完了し、警告を返さない |

UIは有効な警告を受信すると `hierarchidb:bff-warning` eventを発行して警告dialogを表示する。
refresh警告を受信した場合、そのBFF client instanceのrefreshを停止し、次の成功したlogin/token
exchangeまで再ログインを要求する。

UIは `session_mode=stateless` を保存し、token期限の5分前を含め `/auth/refresh` を呼ばない。
期限切れ時にlocal sessionを削除し、次に認証が必要になった時点でloginをやり直す。意図した
`stateless` modeではKV警告dialogを表示しない。警告dialogはquota resetや復旧時刻を断定しない。

## デプロイ前確認

`persistent` の場合だけnamespaceを確認する。

```bash
pnpm exec wrangler kv namespace list
```

両modeでdry-runを実行する。

```bash
pnpm exec wrangler deploy --dry-run \
  --config wrangler.hierarchidb.toml \
  --env production
```

- `AUTH_SESSION_MODE` と `SESSION_DURATION_HOURS` が対象環境へ明示されていることを確認する。
- `persistent` の場合だけ、対象namespace IDと `AUTH_KV` bindingをWrangler設定で照合する。
- `stateless` の場合はKV namespaceの作成・照合を行わない。
- `JWT_SECRET` とOAuth client secretの対象環境を確認し、`persistent` ではnamespace IDも照合する。
- `wrangler deploy --dry-run` がbinding解決エラーなしで終了することを確認する。

## デプロイ後確認

1. 新規loginを完了し、token応答の `session_mode` が設定modeと一致することを確認する。
2. `persistent` ではtoken refreshが成功し、`stateless` では期限前refreshを実行しないことを確認する。
3. `persistent` ではrevoke後、同じsessionのrefreshが `Session not found` で失敗することを確認する。
4. `stateless` ではKV警告dialogが表示されず、期限切れ後に再ログインできることを確認する。
5. `persistent` のWorkerログに次のエラーがないことを確認する。
   - `KV namespace AUTH_KV is not configured`
   - `Failed to store session in KV`
   - `Failed to read session from KV`
   - `Failed to refresh token in KV`
   - `Failed to revoke session in KV`

`persistent` で必要な場合に限り、権限を持つ端末でkeyの存在を確認する。

```bash
pnpm exec wrangler kv key list \
  --binding AUTH_KV \
  --prefix user_auth: \
  --remote \
  --config wrangler.hierarchidb.toml \
  --env production
```

出力にはuser IDが含まれるため保存・共有しない。`session_index:` の一覧はsession tokenを露出するため
取得しない。

## quotaと監視

quota上限とreset条件はCloudflareのplanおよび運用時点の管理画面をSSOTとし、固定値をリポジトリへ
記載しない。アプリケーションはquota超過を他のKVエラーから識別しないため、`kv_error` の発生時は
Cloudflare DashboardのKV使用量、Workerログ、サービス状態を合わせて確認する。

## ロールバック

session mode変更を戻す場合は、modeとbindingを同じdeployで整合させる。

- `stateless` へ戻す: `AUTH_SESSION_MODE=stateless` を設定する。`AUTH_KV` は参照されず、既存JWT期限後に
  再ログインが必要になる。
- `persistent` へ戻す: `AUTH_SESSION_MODE=persistent` と正常な `AUTH_KV` bindingを同時に設定する。
  bindingを用意せずmodeだけを切り替えてはならない。

namespace切替時は旧namespaceを直ちに削除しない。

1. 旧namespace IDとWrangler設定を記録する。
2. 新namespaceをbindingしてdeployする。
3. login、refresh、revokeを検証する。
4. 問題があれば旧namespace IDへbindingを戻して再deployする。
5. rollback期間と既存keyのTTLが終了し、復旧不要と確認できた後だけ旧namespaceを削除する。

別namespaceへ切り替えると、旧namespaceにだけ存在するsessionは新環境で参照できない。意図した
session resetでない限り、この影響を利用者へ告知せずに切り替えてはならない。
