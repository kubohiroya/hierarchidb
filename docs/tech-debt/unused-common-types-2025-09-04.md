# packages/common/types/src の未使用型（削除候補）

- 作成日: 2025-09-04
- 対象: `packages/common/types/src`
- 目的: プロジェクト全体を `ripgrep` で走査し、当該ディレクトリで `export` されている `type/interface/enum/class` のうち、他ファイルから参照されていないものを抽出（＝削除候補としてマーク）。

## 検出条件
- 定義検出: `^export (type|interface|enum|class) NAME` を対象。
- 参照検出: リポジトリ全体（`**/*.{ts,tsx,js,jsx}`、`node_modules` 等は除外）に対して、単語境界一致で `NAME` を検索し、定義元ファイル自身の一致を除外。
- 注意事項:
  - 同一ファイル内のみで使用されているが `export` されている型も「外部未使用」として候補に含みます（`export` の表面積縮小を目的）。
  - バレル経由の再エクスポートを含め、外部参照があれば除外されます。
  - 誤検知/見落としがないか、削除前に個別確認してください。

## 抽出に使用したコマンド

```sh
# 定義一覧（kind|name|file）
rg -n "^export\\s+(type|interface|enum|class)\\s+([A-Za-z0-9_]+)" packages/common/types/src \
  | sed -E 's/^([^:]+):[0-9]+:export (type|interface|enum|class) ([A-Za-z0-9_]+).*/\\2|\\3|\\1/' \
  | sort > .codex/tmp/defs.txt

# 参照カウント（repo 全体。定義元の行は除外）
> .codex/tmp/usage_raw.txt
while IFS='|' read -r kind name file; do
  count=$( (rg -n --glob '!node_modules' --glob '!**/*.map' --glob '!**/dist/**' --glob '!**/build/**' \
                --glob '!**/e2e-results/**' --glob '!**/.turbo/**' -w "${name}" -g "**/*.{ts,tsx,js,jsx}" \
            | grep -v -F "${file}:" | wc -l | tr -d ' ') < /dev/null )
  printf "%s|%s|%s|%s\n" "$kind" "$name" "$file" "$count" >> .codex/tmp/usage_raw.txt
done < .codex/tmp/defs.txt

# 候補（refs==0）
awk -F'|' '$4==0 {print $1 "|" $2 "|" $3}' .codex/tmp/usage_raw.txt > .codex/tmp/unused_zero_refs.txt
```

## 削除候補リスト（refs==0）

以下は「他ファイルからの参照が 0 件」の候補です。最終削除前に、関連コード／再設計の影響を確認してください。

> 形式: `kind | name — file`

<!-- BEGIN GENERATED CANDIDATES -->
interface | AutoLifecycleConfig — packages/common/types/src/entity-plugin-definition.ts
interface | BaseDataSourceConfig — packages/common/types/src/datasource.ts
interface | BaseNodeDefinition — packages/common/types/src/types.ts
interface | BaseUrlMetadata — packages/common/types/src/datasource.ts
interface | BinaryPropertyConfig — packages/common/types/src/plugin-serialization.ts
interface | DependencyError — packages/common/types/src/plugin-resolution.ts
interface | DescendantProperties — packages/common/types/src/tree-node-plugin-definition.ts
interface | DraftProperties — packages/common/types/src/tree-node-plugin-definition.ts
interface | EntityRelationship — packages/common/types/src/entity-plugin-definition.ts
interface | ExpandedStateChanges — packages/common/types/src/tree-root-state-plugin-definition.ts
interface | ExportManifest — packages/common/types/src/import-export-plugin-definition.ts
interface | ExportOptions — packages/common/types/src/import-export-plugin-definition.ts
interface | ExtendedFieldDefinition — packages/common/types/src/types.ts
interface | ExtensionMetadata — packages/common/types/src/types.ts
interface | FileImportOptions — packages/common/types/src/import-export-plugin-definition.ts
interface | GetNodePayload — packages/common/types/src/command-plugin-definition.ts
interface | GetTreePayload — packages/common/types/src/command-plugin-definition.ts
interface | ImportManifest — packages/common/types/src/import-export-plugin-definition.ts
interface | ImportOptions — packages/common/types/src/import-export-plugin-definition.ts
interface | LicenseAgreement — packages/common/types/src/datasource.ts
interface | LocationCountryMetadata — packages/common/types/src/datasource.ts
interface | LocationDataSourceConfig — packages/common/types/src/datasource.ts
interface | LocationSelectionRowData — packages/common/types/src/datasource.ts
interface | LocationUrlMetadata — packages/common/types/src/datasource.ts
interface | PluginI18nConfig — packages/common/types/src/plugin-definition.ts
interface | PluginRegistrationConfig — packages/common/types/src/plugin-resolution.ts
interface | PluginSerializationConfig — packages/common/types/src/plugin-serialization.ts
interface | ReferenceManagement — packages/common/types/src/entity-plugin-definition.ts
interface | ReferenceProperties — packages/common/types/src/tree-node-plugin-definition.ts
interface | RelationalEntityManager — packages/common/types/src/entity-manager-plugin-definition.ts
interface | ResolutionResult — packages/common/types/src/plugin-resolution.ts
interface | ResolvedPlugin — packages/common/types/src/plugin-resolution.ts
interface | RouteCountryMetadata — packages/common/types/src/datasource.ts
interface | RouteDataSourceConfig — packages/common/types/src/datasource.ts
interface | RouteSelectionRowData — packages/common/types/src/datasource.ts
interface | RouteUrlMetadata — packages/common/types/src/datasource.ts
interface | SearchNodesPayload — packages/common/types/src/command-plugin-definition.ts
interface | SelectionColumn — packages/common/types/src/datasource.ts
interface | SelectionRow — packages/common/types/src/datasource.ts
interface | ShapeCountryMetadata — packages/common/types/src/datasource.ts
interface | ShapeDataSourceConfig — packages/common/types/src/datasource.ts
interface | ShapeSelectionRowData — packages/common/types/src/datasource.ts
interface | ShapeUrlMetadata — packages/common/types/src/datasource.ts
interface | TagSearchOptions — packages/common/types/src/tag-entity-plugin-definition.ts
interface | TagUsageStatistics — packages/common/types/src/tag-entity-plugin-definition.ts
interface | TemplateDefinition — packages/common/types/src/import-export-plugin-definition.ts
interface | TemplateImportOptions — packages/common/types/src/import-export-plugin-definition.ts
interface | TreeNodeExportData — packages/common/types/src/import-export-plugin-definition.ts
interface | TypedClientAPIExtensions — packages/common/types/src/api-plugin-definition.ts
interface | TypedWorkerAPIExtensions — packages/common/types/src/api-plugin-definition.ts
interface | WorkerPluginRouterAction — packages/common/types/src/plugin-definition.ts
type | BaseFieldName — packages/common/types/src/stepper-dialog-plugin-definition.ts
type | ClientAPIMethod — packages/common/types/src/api-plugin-definition.ts
type | CommandGroupId — packages/common/types/src/command-plugin-definition.ts
type | IdMapping — packages/common/types/src/import-export-plugin-definition.ts
type | ValidationFunction — packages/common/types/src/validation-plugin-definition.ts
<!-- END GENERATED CANDIDATES -->

## 既知の特殊ケース
- `packages/common/types/src/entiry-working-copy-plugin-definition.ts.bak`（typo あり、`.bak`）
  - 下記エクスポートはすべて外部未使用: `EntityWorkingCopy*`, `*WorkingCopy`, `EntiryWorkingCopyTypes` など計12件。
  - 方針: 削除 or `deprecated/` へ移動を検討。

## 推奨アクション（非破壊）
- 第一段階（このPR）
  - 上記候補を `TASKS.md` に記録（受け入れ基準/ロールバック手順含む）。
  - 実コードは削除せず、まずは「API表面の縮小」を目的に `export` を外し、ファイル内限定利用に降格できるものは降格。
- 第二段階（次PR）
  - 実際に未使用が確定したものを削除（`.bak` は即時削除推奨）。
  - バレル（`RuntimeWorkerService.ts`）の再エクスポートからも除外。

## ロールバック指針
- 影響発生時は、該当コミットをリバートし `RuntimeWorkerService.ts` の再エクスポートを元に戻せば即時復旧可能。

