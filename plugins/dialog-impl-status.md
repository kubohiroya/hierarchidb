# Node-Type Dialog Step State/Navigation Implementation Status

本資料は、`packages/plugins/*-plugin` における作成/編集ダイアログで「入力済み判定」「ステップ遷移可否」がどのように実装されているかの現況まとめです。  
2025 時点の方針: すべてのプラグインは `useDialogDraft`＋`draftMetadata/draftData` を前提とした `HeadlessMultiStepDialog` ホスト（`./ui` default export）に揃える。旧 `ExtensibleFolderDialog` / `NodeDialogExtensionRegistry` は廃止（参照が残っていたら削除対象）。

## サマリー（現行ホスト）

| プラグイン | ダイアログ実装 | 入力済み判定 | ステップ遷移可否 | 主な実装 |
| - | - | - | - | - |
| folder | `FolderDialogHost`（HeadlessMultiStepDialog + useDialogDraft） | BasicInfoStep の validate（name 必須） | validate=true でコミット可、ステッパー自由遷移 | `plugins/folder-plugin/src/ui/FolderDialogHost.tsx` |
| basemap | app 側ホスト + useDialogDraft（BasicInfo は draftMetadata へ） | BasicInfo/独自ステップ | ホスト制御 | `app/src/...` |
| shape | `ShapeDialogHost`（HeadlessMultiStepDialog + useDialogDraft） | 各 Step validate + BasicInfo | validate=true で進行 | `plugins/shape-plugin/src/ui/components/ShapeDialogHost.tsx` |
| spreadsheet | `SpreadsheetDialog`（HeadlessMultiStepDialog + useDialogDraft） | BasicInfo/DataSource/Filtering validate | validate=true で進行 | `plugins/spreadsheet-plugin/src/ui/components/SpreadsheetDialog.tsx` |
| styler | `StylerDialog`（HeadlessMultiStepDialog + useDialogDraft） | Style/Mapping/Filtering 各 Step validate | validate=true で進行 | `plugins/styler-plugin/src/ui/components/StylerDialog.tsx` |
| route | `RouteDialog`（独自だが useDialogDraft 化済み） | 子ステップの onValidationChange | Next 活性で制御 | `plugins/route-plugin/src/components/RouteDialog.tsx` |
| resolver | `ResolverDialog`（useDialogDraft 化済み） | BasicInfo + 各 Step onValidationChange | Next 活性で制御 | `plugins/resolver-plugin/src/ui/components/ResolverDialog.tsx` |
| location | 単票ダイアログ + StepCapabilities | `LocationEntityHandler#getStepCapabilities` | 同上 | `plugins/location-plugin/src/entities/LocationEntityHandler.ts` |
| linker | `ProjectWizard`（独自） | バリデーション無し（Next 常時有効） | 順次遷移のみ | `plugins/linker-plugin/src/components/wizard/ProjectWizard.tsx` |

## 補足: 旧ホストの扱い
- `ExtensibleFolderDialog` / `BaseDialogPlugin` / `NodeDialogExtensionRegistry` は廃止。関連テスト・レポートも削除済み。残存参照があれば除去する。
- `initializeDefaultNodeDialogExtensions` は後方互換用の名残。アプリ側では呼び出さず、`pnpm tools:gen-plugin-registry` が生成する `./ui` default export を動的ロードする方式が正。
- 旧 WizardProvider（`packages/runtime-ui/plugin-dialog/src_deprecated/*`）は参照のみ（削除候補）。現行は HeadlessMultiStepDialog + useDialogDraft が前提。
