# @hierarchidb/yaml-store

最終更新: 2026-08-21

別途reviewするrecovery / retirement作業のため、frozenなlegacy Dexie-based YamlDB v1を保持するpackageである。authoritative runtime storeではない。

## Production boundary

正規契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- CoreDB `TreeNode.metadata/data`がcommitted YAML stateを保持する。
- CoreDB `TreeNode.draftMetadata/draftData`がdraft YAML stateを保持する。
- YamlDBをcache、dual-write先、fallback reader、CoreDB rollback sourceとして使用しない。
- package rootはruntime database APIもmutation APIも公開しない。
- `@hierarchidb/yaml-store/legacy-close`はactivation時の冪等なrevoke / close操作だけを公開する。

基礎となるv1実装は、#1341で明示的なrecovery boundaryを追加・reviewできるようにするためだけに残す。canonical dialog、ZIP、Simulation、Worker、Step 4 routeからはimportしない。物理削除は別の破壊的操作であり、single activation変更の対象外とする。

YamlDBは本番CoreDB migrationから少なくとも30日、かつ後続stable releaseが1回受け入れ済みになるまでの長い方の期間、変更しない。missing name、空schema ID、orphan row、conflictはread-only inventoryで報告し、自動推測、copy、merge、deleteを行わない。

## ライセンス

MIT
