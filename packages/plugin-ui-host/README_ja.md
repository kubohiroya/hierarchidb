# @hierarchidb/plugin-ui-host

最終更新: 2026-04-05

HierarchiDB プラグインダイアログのホスト側 UI コンポーネントパッケージ。`PluginDialogHost` がプラグインのマルチステップダイアログを統合的にホストし、`PluginDialogShell`・`PluginDialogHeader`・`PluginDialogFooter` がダイアログの構造を提供する。

## 主要な機能

- `PluginDialogHost` — プラグインダイアログの統合ホストコンポーネント
- `PluginDialogShell` — ダイアログのシェル（ヘッダー + コンテンツ + フッター）
- `PluginDialogHeader` — ダイアログヘッダー（タイトル、ステップインジケータ）
- `PluginDialogFooter` — ダイアログフッター（ナビゲーション、保存ボタン）

## 公開 API

```typescript
import {
  PluginDialogHost,
  PluginDialogShell,
  PluginDialogHeader,
  PluginDialogFooter,
} from '@hierarchidb/plugin-ui-host';
```

| コンポーネント | 説明 |
| --- | --- |
| `PluginDialogHost` | プラグイン nodeType に応じたステップを `PluginStepRegistry` から取得し、マルチステップダイアログを描画 |
| `PluginDialogShell` | ダイアログの外枠（ヘッダー・コンテンツ・フッターのレイアウト） |
| `PluginDialogHeader` | ステップタイトル・ステップインジケータの表示 |
| `PluginDialogFooter` | 前へ/次へ/保存ボタン、バリデーション状態に応じた有効/無効制御 |

## 依存関係

| パッケージ | 用途 |
| --- | --- |
| `@hierarchidb/plugin-base` | PluginStepRegistry、PluginManifest |
| `@hierarchidb/plugin-ui-sdk` | プラグイン UI SDK |
| `@hierarchidb/plugin-presentation` | プレゼンテーション層 |
| `@hierarchidb/ui-dialog` | ダイアログ基盤 |
| `@hierarchidb/ui-plugin-basic-info` | 基本情報ステップ |
| `@hierarchidb/components` | 共有 UI コンポーネント |
| `jotai` | 状態管理 |

## 関連パッケージ

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginStepRegistry
- [`@hierarchidb/plugin-ui-sdk`](../plugin-ui-sdk/) — プラグイン UI SDK
- [`@hierarchidb/ui-dialog`](../ui/dialog/) — ダイアログ基盤

## ライセンス

MIT
