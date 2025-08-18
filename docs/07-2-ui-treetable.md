## 7.2 TreeTable

この節では、references/eria-cartograph/app0 に置かれている旧コードのうち、SPAのコンソール画面で利用されるツリー管理UIの構成要素を整理します。とくに、以下を対象にファイル一覧のMarkdown表を作成します。
- 起点: src/components/console/ResourcesConsole.tsx, src/components/console/ProjectsConsole.tsx
- 対象: これらから推移的に利用されるコンポーネント、カスタムフック、コンテキストプロバイダ
- 除外: Worker側実装（Comlink経由サービス・Dexie.js等）および src/domains 以下

注意: 以下はUI層の依存に絞っています。テストコードやアナリシス用ドキュメントは対象外です。

### ファイル一覧（1ファイル1行）

| File | Summary |
|---|---|
| references/eria-cartograph/app0/src/components/console/ResourcesConsole.tsx | Resourcesツリー用のコンソール起点。TreeConsoleにResources用のroot/expanded設定を渡して全画面ダイアログで表示する。 |
| references/eria-cartograph/app0/src/components/console/ProjectsConsole.tsx | Projectsツリー用のコンソール起点。TreeConsoleにProjects用のroot/expanded設定を渡して表示する。 |
| references/eria-cartograph/app0/src/shared/components/console/TreeConsole.tsx | コンソールの共通ラッパ。FullScreenDialog上でTreeTableConsolePanelをlazyロードし、ドラッグリーブ時のクリーンアップも提供。 |
| references/eria-cartograph/app0/src/shared/components/dialogs/FullScreenDialog.tsx | 全画面Dialogコンテナ。ドラッグイベントもハンドルし、Paperへリスナを付与。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeTableConsolePanel.tsx | コンソール画面の中核。ヘッダ/ツールバー/コンテンツ/フッタ/アクションを束ね、useTreeViewController等でツリー状態とCRUD・D&Dを管理。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleHeader.tsx | パンくずや右上のアクション群（プレビュー切替等）を持つヘッダ。ページ種別に応じて背景色を切替。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleBreadcrumb.tsx | パンくずナビ。Trash/Projects/Resourcesの文脈に応じた遷移と各種操作のハブ。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleToolbar.tsx | 画面上部のツールバー選択。メイン/検索専用のどちらを出すか、Trash操作のナビゲーションも担当。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleToolbarContent.tsx | 検索、Undo/Redo、Copy/Paste、Duplicate/Remove、Import/Export、Trash管理、クリック動作切替などツールバー本体。 |
| references/eria-cartograph/app0/src/features/tree-console/components/SearchOnlyToolbar.tsx | 検索専用トバー。DebouncedInputで検索文字列を制御。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleContent.tsx | メインコンテンツ切替。空表示/ボタン表示/ツリー表の3状態管理、NodeInfoDisplay・TreeTableCoreのレイアウト制御、D&D設定提供。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleContentErrorBoundary.tsx | コンテンツ描画のエラーバウンダリ。再試行・Rootへ戻る・リロードなどのフォールバックを提供。 |
| references/eria-cartograph/app0/src/features/tree-console/components/NodeInfoDisplay.tsx | 選択ノードの種類/名称/説明と編集・プレビューボタンを提示。ツリー深さに応じたレインボー配色アイコン。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleFooter.tsx | 下部フッタ。選択数・フィルタ件数・総件数の要約表示とガイド起動ボタン。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeConsoleActions.tsx | 右下のSpeedDial（作成アクション群）と戻るボタン配置。ページ種別に応じたカラー適用。 |
| references/eria-cartograph/app0/src/features/tree-console/components/TreeTableConsolePanelContext.tsx | TreeTableConsolePanelに関するコンテキスト（パネル内の共有状態）を提供。 |
| references/eria-cartograph/app0/src/features/tree-console/components/UndoRedoButtons.tsx | Undo/Redo専用の小コンポーネント（ツールバー分離用途）。 |
| references/eria-cartograph/app0/src/features/tree-console/types/index.ts | コンソール各部のProps/NodeInfo型など型定義の集約。 |
| references/eria-cartograph/app0/src/shared/components/ui/InlineIcon/InlineIcon.tsx | 行内にアイコンを綺麗に並べるための小さなラッパ。 |
| references/eria-cartograph/app0/src/shared/components/ui/LinkButton/LinkButton.tsx | 非同期検証/確認ダイアログ/トースト/多段ワークフロー対応の汎用ボタン。NodeInfoDisplay等から利用。 |
| references/eria-cartograph/app0/src/components/ui/SpeedDialMenu/SpeedDialMenu.tsx | 右下のスピードダイアル。クリックで開閉、アクション選択時に自動クローズ。 |
| references/eria-cartograph/app0/src/components/ui/SpeedDialMenu/SpeedDialActionType.tsx | SpeedDialのアクション定義型。アイコン/名称/色/クリックハンドラを保持。 |
| references/eria-cartograph/app0/src/features/tree-table/components/TreeTableCore.tsx | 仮想化/列/セル/行操作を統合したツリーテーブル中核。D&D、選択、開閉、レンダリング最適化を担う。 |
| references/eria-cartograph/app0/src/features/tree-table/components/TreeTableFlashPrevention.tsx | WebKit等でのヘッダ・レイアウト点滅を抑止するためのラッパ。 |
| references/eria-cartograph/app0/src/features/tree-table/components/TreeTableVirtualization.tsx | スクロール仮想化の実装（大規模木の描画効率化）。 |
| references/eria-cartograph/app0/src/features/tree-table/components/rows/TreeTableRowCore.tsx | 1行の描画とインタラクションの中核。選択/コンテキストメニュー等と連携。 |
| references/eria-cartograph/app0/src/features/tree-table/components/cells/DebouncedInput.tsx | 入力のデバウンス制御付きテキスト入力（検索やインライン編集用）。 |
| references/eria-cartograph/app0/src/features/tree-table/components/controls/RowContextMenuMUI.tsx | 行の右クリックメニュー。開く/編集/複製/削除/作成/参照確認/プレビュー等、可用性に応じて切替。 |
| references/eria-cartograph/app0/src/features/tree-table/contexts/DragDropConfigContext.tsx | D&D設定のコンテキスト。テーマ統合・プリセット・永続化・可用性チェック等。 |
| references/eria-cartograph/app0/src/features/tree-view-controller/hooks/useTreeViewController.tsx | ツリービューの状態・操作を一括管理する巨大フック。CRUD/選択/展開/検索/Import-Export/ショートカット等。 |

補足:
- ここに列挙していない細粒度のセル/列コンポーネントも多数存在しますが、TreeTableCore 内部でまとめて利用されます。
- Worker/API/DB関連（useWorkerServicesやCommandManagerの実体等）はUI側から呼び出すだけのため、本表から除外しています。

### 今後の拡張
- ProjectsConsole も ResourcesConsole と同じTreeConsole/TreeTable系の構成を共有しています。本表は両者に共通するUI部品を包括しています。
- 必要に応じてセル単位の部品（NodeNameCellなど）や、ツールバー内のメニュー項目別の詳細も追補可能です。
