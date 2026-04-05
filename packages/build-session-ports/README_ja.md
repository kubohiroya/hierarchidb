# @hierarchidb/build-session-ports

最終更新: 2026-04-05

HierarchiDB ビルドセッションのポート（インターフェース）定義パッケージ。ビルドセッション制御、アーティファクトストア、タスクレジストリ、ステージ制御の抽象ポートを提供する。Hexagonal Architecture のポート層に相当する。

## 主要なポート

| ポート | 説明 |
| --- | --- |
| `BuildSessionControlPort` | セッションの開始・一時停止・再開・購読 |
| `ArtifactStorePort` | ステージ間アーティファクト（バッファ）の永続化・取得 |
| `TaskRegistryPort` | タスクの登録・ステージ別解決・入力ロード |
| `StageControls` | ステージ実行の制御インターフェース |
| `ProgressInfoBase` | 進捗情報の基底型 |

## 依存関係

`@hierarchidb/core-types` のみ。

## 関連パッケージ

- [`@hierarchidb/build`](../build/) — ポートの実装を利用するビルド基盤
- [`@hierarchidb/build-api`](../build-api/) — イベント型定義

## ライセンス

MIT
