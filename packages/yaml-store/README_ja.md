# @hierarchidb/yaml-store

最終更新: 2026-08-20

現行のlegacy Dexie-based YamlDB v1とCRUD helperを提供するpackage。YAML domain dataのauthoritative storeではない。

## Storage authority

正規契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- CoreDB `TreeNode.metadata/data`がcommitted YAML stateを保持する。
- CoreDB `TreeNode.draftMetadata/draftData`がdraft YAML stateを保持する。
- YamlDB v1はfrozenかつnon-authoritativeなlegacy recovery sourceであり、cacheまたはdual-write先として使用しない。
- CoreDBとYamlDBは別IndexedDBであり、1つのtransactionに含められない。CoreDB migrationとYamlDB inventory/recoveryは別Issue・別atomic boundaryとする。

後続のrecovery / retirement Issueが完了するまで、sourceには`getYamlDB()`とmutation helperが残る。これらはlegacy専用であり、canonical dialog、ZIP、simulation、Step 4 runtime pathから呼び出してはならない。現行の[folder YAML import](../../plugins/folder-plugin/README_ja.md#legacy-yaml-snapshot-boundary)はYamlDB-only rowへwriteするnon-canonical実装であり、cutoverをblockedとする。missing name、空schema ID、orphan row、conflictはread-only inventoryで報告し、自動推測、copy、merge、deleteを行わない。

YamlDBの物理削除は別の破壊的操作とする。本番CoreDB migrationから少なくとも30日、かつ後続stable releaseが1回受け入れ済みになるまでの長い方をrollback observation / recovery windowとし、YamlDBを変更しない。inverse CoreDB migrationはYamlDBをread / modifyせず、YamlDBをCoreDB rollback sourceとして使用しない。

## 依存関係

`@hierarchidb/core-types`, `@hierarchidb/util`, `@hierarchidb/yaml-api`

## 関連パッケージ

- [`@hierarchidb/yaml-api`](../yaml-api/) — YAML API 型定義
- [`@hierarchidb/core-types`](../core-types/) — 共有型定義
- [`正規storage契約`](../../docs/yaml-plugin-ide-gsm-step4-spec.md) — authority、migration、recovery、rollback規則

## ライセンス

MIT
