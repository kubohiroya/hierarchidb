# Plugin Dialog Layering – Current State and Consolidation Plan

_Last updated: 2025-10-30_

## 1. 現状整理（責務と依存関係）

| レイヤー | 主な所在 | 役割/エクスポート | 主な依存 |
| --- | --- | --- | --- |
| **Author SDK** | `packages/plugin-ui-sdk/src/dialog` | プラグイン作者向け API（`BaseDialogPlugin`, `NodeDialogPlugin`, `NodeDialogExtensionAPI` 等）<br>Dialog ステップの定義・登録、WorkingCopy とのブリッジ | `@hierarchidb/plugin-service-api`, コア型 (`PeerEntity` など) |
| **Presentation API** | `packages/plugin-presentation/src` | `getPresentation`, `getIconComponent`, `prefetchAllIcons` 等プレゼンテーションメタデータの取得とキャッシュ | `@hierarchidb/ui-icon` |
| **Runtime Host UI** | `packages/plugin-ui-host/src` | `PluginDialogHost`（ファサード）, `PluginDialogShell`, `PluginDialogFooter`, `PluginDialogHeader` 等ホストアプリ向け UI / プレゼンテーション層 | `react`, `@mui/*`, `@tanstack/react-router`, `@hierarchidb/runtime-client` |
| **Generic Dialog Components** | `packages/ui/dialog/src` | 共通ダイアログコンポーネント（`CommonDialog`, `AutoHideFullScreenDialog` 等）<br>プラグイン固有の知識は持たず UI スタイルに特化 | `@mui/*` |
| **App Host Wiring** | `app/src/router/routes/tree/PluginDialogRoute.tsx` | React Router との接続、WorkingCopy ID リダイレクト、完了時ナビゲーション<br>`PluginDialogHost` ファサード経由でホスト固有オプションを注入 | `@tanstack/react-router`, `@hierarchidb/runtime-client`, `@hierarchidb/plugin-ui-host` |

### 1.1 現状の問題点
- ヘッドレスロジックが `plugin-ui-sdk` と `ui/plugin-dialog` の双方に散在し、責務境界が不明瞭。
- `PluginDialogShell` がアプリ固有のルーティング／WorkingCopy 処理を一部抱え、ホストごとの再利用が難しい（→ `PluginDialogHost` ファサードで吸収する）。
- プレゼンテーションメタデータの参照元が複数（app 独自サービスと UI util）に分散しており、キャッシュ整合が取りにくい。
- パッケージ名と実際の機能が一致しにくく、学習コストが高い（`ui-plugin-dialog` がヘッドレス処理も内包）。
- ドキュメントが複数 README/タスクログに分散しており、俯瞰できる資料がない。

## 2. 改善オプション

| 案 | 概要 | メリット | デメリット / リスク |
| --- | --- | --- | --- |
| **Option A: `@hierarchidb/plugin-base` 新設** | ヘッドレス機能（コントローラー、レジストリ、WorkingCopy ブリッジ）を新パッケージへ移動。`plugin-ui-sdk` は作者向け API を再エクスポートし、`plugin-ui-host` は UI に特化。 | レイヤーが明確化／テスト容易化。ホスト・作者両者が同じ抽象を参照できる。 | 新パッケージ追加による依存更新が広範。リリース順序管理が必要。 |
| **Option B: `@hierarchidb/plugin-dialog` へ統合** | `plugin-ui-sdk` と `plugin-ui-host` を単一パッケージの `/core`・`/ui` サブパスとして公開。 | 参照先が 1 つになり導入が簡単。 | 大規模な rename／公開範囲拡大でリリースが重い。軽量利用でも UI バンドルを引き込みがち。 |
| **Option C: パッケージ維持 + ガイド整備** | 既存構成を保ちつつ、責務を再整理／ドキュメント整備。ヘッドレスロジックを片側へ寄せるなど小改修。 | 影響が小さく短期でできる。 | 根本的な散在は残り、長期的には再び混乱する恐れ。 |

## 3. 推奨方針（Option A）

### 3.1 概要
- `@hierarchidb/plugin-base` を新設し、以下を移設
  - `usePluginDialogController` と関連型
  - Step / Host registry（`PluginStepRegistry`, `HostProfileRegistry`）
  - WorkingCopy/PeerStore ブリッジ（`getWorkerBridge`, WorkingCopy hooks）
  - URL 同期・状態管理ロジック
- `@hierarchidb/plugin-ui-sdk` は作者向け API を `plugin-base` から再エクスポート。
- `@hierarchidb/plugin-ui-host` は UI コンポーネント（シェル、フッター、ステッパー）と `PluginDialogHost` ファサードに集中させる。
- プレゼンテーションメタデータは新設パッケージ `@hierarchidb/plugin-presentation` に集約し、App/UI 双方が同じ API を利用する。

### 3.2 段階的移行プラン

1. **Discovery**（~2営業日）
   - エクスポート一覧・依存マップを完成させる（本ドキュメントの詳細版）。
   - ADR 下書きを作成し、関係者レビューを実施。

2. **Core 抽出**（2〜3 PR）
   - 新パッケージ雛形（tsconfig, package.json, turbo 設定）を追加。型／ビルド手順を整備。
   - `ui-plugin-dialog` からヘッドレスロジックを移動し、旧エントリは deprecate。`plugin-ui-sdk` から再エクスポート。
   - 既存利用箇所（アプリ／プラグイン）は挙動変更なしでビルドが通ることを確認。

3. **ホスト統合**（1〜2 PR）
   - `@hierarchidb/plugin-ui-host` に `<PluginDialogHost />` を追加し、ルーターや WorkingCopy リダイレクトをコンポーネント化。
   - `app` 側はルート定義／ナビゲーションコールバックを渡すだけで利用できる形に刷新。

4. **整備・ドキュメント**（1 PR）
   - 旧エクスポートに deprecation を添付し、Knip/dep-fence で逆依存を監視。
   - `docs/architecture/plugin-dialog-layering.md` / README を更新し、導入ガイドとロールバック手順を記載。

### 3.3 検証とロールバック
- 検証コマンド例：
  - `pnpm --filter @hierarchidb/plugin-dialog-core typecheck`
  - `pnpm --filter @hierarchidb/plugin-ui-host build`
  - `pnpm --filter @hierarchidb/app typecheck`
- ロールバック：該当パッケージの差分を revert し、旧構成で再ビルド。Turbo 依存を元に戻す。

## 4. 既存ドキュメントとの整合
- `packages/plugin-ui-host/README.md` … Shell と controller の役割を刷新後に更新。
- `docs/architecture/plugin-dialog-integration.md` … Base/Host 分割後にシーケンス図を改版。
- `docs/deprecated/...` 内の旧ガイド … 新構成への誘導リンクを追記。

## 5. 次のステップ
1. ADR（`docs/architecture/adr/2025-xx-plugin-dialog-layering.md` 予定）を起案してレビュー依頼。
2. Turbo/pnpm 設定への影響を整理し、必要な pipeline 変更を issue 化。
3. Core 抽出フェーズ用のタスク細分化（例: `refactor/plugin-dialog-core/extract-controller` など）を Kanban に追加。
4. App 依存の集約先としては `@hierarchidb/ui-shell` のみを利用し、feature 系パッケージは実体（`@hierarchidb/common-types`, `@hierarchidb/plugin-registry` 等）を直接 import する方針に更新済み。ガイド類でもこの構成を前提とする。

---

_作成: design/plugin-dialog-layering タスク_ 
