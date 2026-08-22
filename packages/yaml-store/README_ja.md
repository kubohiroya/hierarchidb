# @hierarchidb/yaml-store

最終更新: 2026-08-22

別途reviewするread-only inventory、retention、retirement作業のため、frozenなlegacy Dexie-based YamlDB v1を保持するpackageである。authoritative runtime storeではない。

## Production boundary

正規契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- CoreDB `TreeNode.metadata/data`がcommitted YAML stateを保持する。
- CoreDB `TreeNode.draftMetadata/draftData`がdraft YAML stateを保持する。
- YamlDBをcache、dual-write先、fallback reader、CoreDB rollback sourceとして使用しない。
- package rootはruntime database APIもmutation APIも公開しない。
- `@hierarchidb/yaml-store/legacy-close`はactivation時の冪等なrevoke / close操作だけを公開する。
- `@hierarchidb/yaml-store/readonly-inventory`はlegacy YamlDB v1のread-only inventory entrypointだけを公開する。公開結果はaggregate count、stable code、決定的な#1341 accounting classification、row単位のstable identifier、任意のaggregate target-comparison count、deterministic source digestに限定する。

基礎となるv1実装は、#1341 successor作業でhistorical rowをupgradeまたはmutateせずにread/accountするためだけに残す。canonical dialog、ZIP、Simulation、Worker、Step 4 routeからはimportしない。物理削除は別の破壊的操作であり、single activation変更の対象外とする。

YamlDBは本番CoreDB migrationから少なくとも30日、かつ後続stable releaseが1回受け入れ済みになるまでの長い方の期間、変更しない。missing name、空schema ID、orphan row、absent target、conflictはread-only inventoryで報告し、自動推測、copy、repair、merge、discard、recovery、deleteを行わない。将来historical write pathが必要な場合は、別の明示的なcontract Issueを必須とする。

## #1341 accounting classification

read-only inventoryは全rowを次のいずれか1分類へaccountする。

- `duplicate/no-op`: CoreDB targetのnode ID、`nodeType: "yaml-file"`、parent ID、metadata name、subtype、schemaId、contentがbyte-for-byteで一致する。
- `recoverable`: target nodeが存在せず、node IDまたはsibling衝突がなく、回復先parentがfolderとして存在する。
- `orphan/blocked`: 回復先parentが存在しない、またはfolderではない。
- `conflict`: target nodeまたは同一parentのsiblingが存在するが、完全一致ではない。
- `invalid`: row shape、key、registry tuple、canonical payload validationのいずれかが不正である。
- `explicitly-discarded`: rowのstable identifierと理由を含む別途のユーザー承認記録が存在する。

これらの分類はaccounting evidenceであり、`recoverable`はwrite authorityではない。`explicitly-discarded`もsource rowを削除しない。row単位のevidenceはclassificationとclassification非依存のstable digest identifierだけを公開し、node ID、parent ID、filename、schemaId、YAML content、credential、native errorを公開しない。malformedなdiscard承認と曖昧なcanonical target snapshotはskipや入力順上書きにせずfail-closedにする。

## ライセンス

MIT
