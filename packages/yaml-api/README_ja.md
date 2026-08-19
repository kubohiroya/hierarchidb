# @hierarchidb/yaml-api

最終更新: 2026-08-20

YAML pluginとstorage／実行consumerで共有するpureな型・validation契約を提供する。

## Canonical IDE-GSM契約

このpackageは次をexportする。

- 正確な12値からなる`YamlSubtype` union
- subtype、schema ID、canonical filename、command capabilityの単一SSOTである`YAML_SUBTYPE_REGISTRY`
- registryから導出する20件のlocal command→pinned GraphQL mutation mapping
- 完全な12 template契約である`YAML_CANONICAL_TEMPLATES`
- unknownまたは不整合な契約値を`YamlContractError`にするstrict validator
- strictな`rsync.yml` / `git.yml`を含む全schema IDのJSON Schema

`scenario-base`、`calib`、`remote-base`、`ssh-base`、`ec2-base`のcommand capabilityは明示的な空集合である。unknown subtype、command、schema ID、filenameにdefaultやaliasを割り当ててはならない。

## 現在のruntime境界

Issue #1266はpure API contractだけを導入し、永続化データやruntime consumerを変更しない。

- `YamlFileNodeData`は既存の`name`、`schemaId`、`content`形状を一時的に維持する。
- `YAML_TEMPLATES`は既存3-step UIが利用する10 templateのままとする。
- `YAML_CANONICAL_TEMPLATES`を後続cutover用の新しい12 template契約とする。
- `findYamlTemplate`と`getYamlSchema`は既存consumer向けのnon-throwing lookupを維持する。新規のstrict pathはexportされたcontract validatorを使用する。

storage migration、`metadata.name`へのcutover、ZIP import/export、UI統合はEpic #1162配下の後続Issueで実施する。

## Storage authorityとmigration boundary

正規のstorage契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- CoreDB `TreeNode.metadata/data`を唯一のauthoritative committed storeとする。
- CoreDB `TreeNode.draftMetadata/draftData`を唯一のauthoritative draft storeとする。
- 独立したYamlDB v1はfrozenかつnon-authoritativeなlegacy recovery sourceであり、cacheまたはdual-write先ではない。
- CoreDB migrationとYamlDB inventory/recoveryは別IndexedDBを扱うため、別のatomic boundaryとする。
- missing legacy name、空schema ID、unknown tuple、conflictはerrorとして報告し、consumerによる推測や補完を禁止する。

現行`YamlFileNodeData`型は、writerとstorage migrationの後続Issueが全consumerを協調してcutoverするまでのlegacy runtime shapeである。この型の存在はYamlDBをauthoritative storeにしない。

## Dormant migration planner

`@hierarchidb/yaml-api/migration`は、pureかつread-onlyなCoreDB YAML migration planner専用のexport entryである。package rootから再exportせず、CoreDB、Dexie、worker、plugin preload、production reader / writerへ接続しない。

callerはraw YAML node candidate、明示的なmigration IDとCoreDB version pair、SHA-256 digest portを渡す。plannerはstorageをread / writeせず、versionまたはmigration IDを生成せず、別digestへfallbackしない。1件でもinvalid recordまたはdigest failureがあればsanitized error reportだけを返し、partial planを返さない。

各raw candidateはnode versionをown data propertyのnon-negative safe integerとして持たなければならない。success planは全candidateに対するdeterministicなsource / node / version guardを持つ。後続activation coordinatorは同じimmutable raw snapshotを非公開で保持し、versionchange transaction内でraw slot state全体を再比較する。plannerはそのsnapshotを永続化、serialize、log出力しない。

YAML content validationはcurrent revisionの`YAML_SCHEMAS`に宣言されたconstraintをstrict Ajv optionで適用する。未宣言のrequired propertyまたはglobalな`additionalProperties: false`を追加しない。`rsync.yml`と`git.yml`で明示されたstrictnessを正規契約とする。

## 依存関係

- `@hierarchidb/core-types`
- `ajv`
- `yaml`

## 関連package

- [`@hierarchidb/yaml-store`](../yaml-store/) — legacy YamlDB v1 recovery boundary（authoritative runtime storeではない）
- [`@hierarchidb/core-types`](../core-types/) — 共有型定義

## ライセンス

MIT
