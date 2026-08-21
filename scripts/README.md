# 環境設定管理ガイド

## 現行コマンド

| 用途 | コマンド | 認証先 |
| --- | --- | --- |
| 開発 | `pnpm dev` | 共通BFF + 実OAuth |
| production preview | `pnpm preview:init` | 共通BFF + 実OAuth |
| Playwright E2E | `pnpm e2e` | canonical mocked OAuth fixture |
| Shape startup E2E | `pnpm e2e:shape-startup` | canonical mocked OAuth fixture |

開発・production buildの公開設定は `scripts/env/*.sh`、ローカル秘密値はGit管理外の
`app/.env.secrets`から読み込む。削除済みの `start-local.sh`、mock BFF server、
`scripts/env/local.sh` は使用しない。

## E2E認証

通常のPlaywright E2Eは `e2e/fixtures/canonicalAuthFixture.ts` を唯一の成功認証fixtureとする。
実アクセストークン、`e2e/.auth/auth.json`、`E2E_AUTH_*` は使用しない。401やcallback failureを
検証するnegative testだけが、対象エラー応答をtest内で明示的にmockできる。

詳細は `docs/e2e-authentication-spec.md` を参照する。

## セキュアな環境変数

- `app/.env.secrets` はGitへ追加しない。
- production secretはCloudflare/GitHubのsecret管理を使用する。
- token、cookie、localStorage sessionをログやE2E artifactへ出力しない。
