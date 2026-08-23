# Map Export Profile and Cache Policy

## 目的

本書は、地図画像生成CLIの browser profile / IndexedDB profile と cache policy を定義する。runner は通常ブラウザprofileを既定では使わず、CLI専用profileを使う。

## Profile policy

| Mode | CLI option | Profile | 用途 |
| --- | --- | --- | --- |
| `default-persistent` | none | runner既定のCLI専用永続profile | 通常実行。cache再利用を有効にする |
| `explicit-persistent` | `--profile <dir>` | 指定された永続profile | CIや用途別profileを明示する |
| `temporary-fresh` | `--fresh` | 実行ごとの一時profile | profile stateを持ち越さない検証 |

`--fresh` と `--profile` は同時指定できない。通常Chrome profileやユーザーが開いている既存profileを自動共有してはならない。

## Cache policy

| Policy | CLI option | 意味 |
| --- | --- | --- |
| `reuse` | none | 既存canonical buildのcache identity/reconcileに従って再利用する |
| `fresh` | `--fresh` | 一時profileを使い、既存profile cacheを読まない |
| `offline` | `--offline` | 外部fetchが必要なcache missは typed error で失敗する |
| `refresh` | `--refresh` | 対象node境界の関連cache/artifactを削除して再buildする |

`--offline` と `--refresh` は同時指定しない。`offline` cache miss は外部fetchへfallbackせず失敗する。

## Refresh boundary

`refresh` は対象jobで作成または更新するnodeだけを対象にする。無関係nodeのCoreDB data、plugin DB cache、artifact、session stateを削除してはならない。

cache identity、artifact reconcile、auth-required、pause/failure semantics は canonical build に委譲する。CLI runner側で独自cache keyや独自stale判定を実装しない。

## 同一profile内の実行

初期版では、同一browser profile / IndexedDB profile内のexport job同時実行を拒否または逐次化する。複数jobを持つmanifestは deterministic order で1件ずつ処理する。
