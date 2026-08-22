# @hierarchidb/yaml-store

最終更新: 2026-08-21

別途reviewするread-only inventory、retention、retirement作業のため、frozenなlegacy Dexie-based YamlDB v1を保持するpackageである。authoritative runtime storeではない。

## Production boundary

正規契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- CoreDB `TreeNode.metadata/data`がcommitted YAML stateを保持する。
- CoreDB `TreeNode.draftMetadata/draftData`がdraft YAML stateを保持する。
- YamlDBをcache、dual-write先、fallback reader、CoreDB rollback sourceとして使用しない。
- package rootはruntime database APIもmutation APIも公開しない。
- `@hierarchidb/yaml-store/legacy-close`はactivation時の冪等なrevoke / close操作だけを公開する。
- `@hierarchidb/yaml-store/readonly-inventory`はlegacy YamlDB v1のread-only inventory entrypointだけを公開する。公開結果はaggregate count、stable code、任意のaggregate target-comparison count、deterministic source digestに限定する。

基礎となるv1実装は、#1341 successor作業でhistorical rowをupgradeまたはmutateせずにread/accountするためだけに残す。canonical dialog、ZIP、Simulation、Worker、Step 4 routeからはimportしない。物理削除は別の破壊的操作であり、single activation変更の対象外とする。

YamlDBは本番CoreDB migrationから少なくとも30日、かつ後続stable releaseが1回受け入れ済みになるまでの長い方の期間、変更しない。missing name、空schema ID、orphan row、absent target、conflictはread-only inventoryで報告し、自動推測、copy、repair、merge、discard、recovery、deleteを行わない。将来historical write pathが必要な場合は、別の明示的なcontract Issueを必須とする。

## ライセンス

MIT
