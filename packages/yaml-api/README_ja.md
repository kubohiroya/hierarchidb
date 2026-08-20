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

## Canonical validation境界

`@hierarchidb/yaml-api/validation`はcanonical-onlyな独立export entryである。`validateYamlCanonicalPayload(filename, payload)`はfilename、subtype、schema ID、contentの完全な組をregistryとcurrent JSON Schemaに対して検証し、新しく構成した検証済みpayload valueを返す。

facadeはlegacy、mixed、incomplete、unknown、accessor付き、non-plain payloadを拒否する。YAML 1.2の単一plain mappingとしてparseし、coercion、default、property除去、未宣言schema制約の追加なしでstrict Ajv validationを行う。stable errorには安全なcodeとfield/reason contextだけを含め、raw payload、YAML本文、parser detail、getterまたはProxyが投げたmessageを返さない。

neutral implementationはpackage内部に閉じる。migration subpathは同じkernelをinternal adapter経由で使用し、legacy-with-name、host-split-legacy、canonicalをstrictに分類しながらerror precedence、ordering、redactionを維持する。canonical-only facadeはhost-split payloadを引き続き拒否する。package rootはvalidationまたはinverse migrationを再exportせず、Ajv、YAML、migration、validation、inverse-migration moduleをloadしない。

## Storage authorityとmigration boundary

正規のstorage契約は[`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md)で定義する。

- CoreDB `TreeNode.metadata/data`を唯一のauthoritative committed storeとする。
- CoreDB `TreeNode.draftMetadata/draftData`を唯一のauthoritative draft storeとする。
- 独立したYamlDB v1はfrozenかつnon-authoritativeなlegacy recovery sourceであり、cacheまたはdual-write先ではない。
- CoreDB migrationとYamlDB inventory/recoveryは別IndexedDBを扱うため、別のatomic boundaryとする。
- missing legacy nameを受理するのは、own data keyが`schemaId`と`content`だけのhistorical host-split payloadを対応metadata nameとregistryの単一entryに対して検証できた場合だけとする。partial payload、空schema ID、unknown tuple、conflictはerrorとし、consumerによる一般的なmetadata fallbackを禁止する。

現行`YamlFileNodeData`型は、writerとstorage migrationの後続Issueが全consumerを協調してcutoverするまでのlegacy runtime shapeである。この型の存在はYamlDBをauthoritative storeにしない。

## Dormant migration planner

`@hierarchidb/yaml-api/migration`は、pureかつread-onlyなCoreDB YAML migration planner専用のexport entryである。package rootから再exportせず、CoreDB、Dexie、worker、plugin preload、production reader / writerへ接続しない。

callerはraw YAML node candidate、明示的なmigration IDとCoreDB version pair、SHA-256 digest portを渡す。plannerはstorageをread / writeせず、versionまたはmigration IDを生成せず、別digestへfallbackしない。1件でもinvalid recordまたはdigest failureがあればsanitized error reportだけを返し、partial planを返さない。

各raw candidateはnode versionをown data propertyのnon-negative safe integerとして持たなければならない。success planは全candidateに対するdeterministicなsource / node / version guardを持つ。後続activation coordinatorは同じimmutable raw snapshotを非公開で保持し、versionchange transaction内でraw slot state全体を再比較する。plannerはそのsnapshotを永続化、serialize、log出力しない。

YAML content validationはcurrent revisionの`YAML_SCHEMAS`に宣言されたconstraintをstrict Ajv optionで適用する。未宣言のrequired propertyまたはglobalな`additionalProperties: false`を追加しない。`rsync.yml`と`git.yml`で明示されたstrictnessを正規契約とする。

migration modeはlegacy-with-nameとcanonicalに加え、exact historical `{ schemaId, content }` host-split payloadだけを受理する。`{ schemaId }`、missing content、余分またはsymbol key、accessor、ambiguous registry matchを受理しない。各migrate entryとjournal valueは`preimageRepresentation: legacy-with-name | host-split-legacy`を持つ。`legacyName`はlegacy-with-nameでは検証済みpayload / metadata共通name、host-split-legacyでは検証済みmetadata nameとする。

## Dormant inverse migration planner

`@hierarchidb/yaml-api/inverse-migration`はpureかつdormantな独立export entryである。`planExactYamlCoreDbInverseMigration`と`planReleaseYamlCoreDbInverseMigration`を別関数・別typeとして公開し、generic mode、publicationのdefault、exactからreleaseへのfallbackを提供しない。CoreDB、Dexie、YamlDB、worker、feature flag、production reader / writerへ接続しない。

exact planは明示的な`canonical-writer-never-published`、全raw node / forward journal snapshot、forward plannerと同じSHA-256 digest portを必須とする。journal cohort、compound key、node / slot存在、preimage representation、legacy name、再計算したcanonical postimage digestをstrictに検証し、journal対象slotだけを復元する。`legacy-with-name`はexact `{ name, schemaId, content }`、`host-split-legacy`は`name`を追加せずexact `{ schemaId, content }`へ復元する。release planは明示的な`canonical-writer-published-or-unknown`を必須とし、journalを使わず、存在する全slotのcanonical validation成功後にだけ全slotをlegacy-with-nameへ復元する。両plannerは`schemaId`と`content`をbyte-for-byteで維持する。

inputとraw snapshotはgetterを実行せずown data descriptor経由で検査する。unsafe、incomplete、extra、symbol付き、accessor付き、duplicate、non-plain、reflection failureを含む値を拒否する。successはnode guardと、exactではjournal guardを含むdeeply immutableかつdeterministicなcomplete planを返す。1件でも失敗すればredacted code/context errorだけを返し、partial entries / guardsを返さない。

これらのplanはwriteの許可ではない。後続coordinatorは明示的なpublication requirementをruntime事実へ結び付け、同じimmutable raw snapshotを非公開保持し、より新しいCoreDB versionchange transaction内でnode / journalの完全な状態をraw再読して比較した後、planをall-or-noneで適用する。

## 依存関係

- `@hierarchidb/core-types`
- `ajv`
- `yaml`

## 関連package

- [`@hierarchidb/yaml-store`](../yaml-store/) — legacy YamlDB v1 recovery boundary（authoritative runtime storeではない）
- [`@hierarchidb/core-types`](../core-types/) — 共有型定義

## ライセンス

MIT
