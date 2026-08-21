# 環境設定アーキテクチャ

## 設計原則

公開可能な共通値を `base.sh`、環境差分を各環境script、ローカル秘密値をGit管理外の
`app/.env.secrets` に分離する。

```text
base.sh
  └─ development.sh / staging.sh / production.sh
       └─ app/.env.secrets（任意）
            └─ pnpm script
```

読み込み後の優先順位は `.env.secrets`、環境別設定、`base.sh` の順である。

## ファイル

| ファイル | 用途 |
| --- | --- |
| `scripts/env/base.sh` | 公開可能な共通設定 |
| `scripts/env/development.sh` | `pnpm dev` の開発設定 |
| `scripts/env/staging.sh` | staging向け差分 |
| `scripts/env/production.sh` | buildとproduction previewの設定 |
| `app/.env.secrets` | Git管理外の秘密値 |

削除済みの `scripts/env/local.sh` は使用しない。通常のPlaywright E2E認証は環境scriptや実OAuth
secretに依存せず、`docs/e2e-authentication-spec.md` のcanonical mocked OAuth fixtureを使用する。

## 実行

```bash
pnpm dev
pnpm dev:production
pnpm preview:init
```

rootの `package.json` が対象の環境scriptを読み込み、その後に存在する場合だけ
`app/.env.secrets` を読み込む。

## 設定の変更

共通の公開値は `base.sh` に追加する。特定環境だけの公開値は対応する環境scriptへ追加する。
API keyやsecretは `app/.env.secrets` またはCI/CD・Cloudflareのsecret管理へ設定し、Gitへ追加しない。

設定値を確認する場合は、実行対象と同じ環境scriptを明示的に読み込む。

```bash
bash -lc 'set -a; source scripts/env/development.sh; env | grep VITE_'
bash -lc 'set -a; set -x; source scripts/env/production.sh'
```

## 新しい環境の追加

1. 既存の環境scriptを基に、`base.sh` を読み込む差分scriptを追加する。
2. root `package.json` に読み込み用scriptを追加する。
3. 公開値だけがGit管理対象であることを確認する。
4. 対応する起動・buildを実行し、終了コードを確認する。

## セキュリティ

- token、cookie、session内容をログへ出力しない。
- `app/.env.secrets` をGitへ追加しない。
- production secretはCloudflareまたはCI/CDのsecret管理を使用する。
- 通常E2Eのために実OAuth credentialや保存済みsessionをコピーしない。
