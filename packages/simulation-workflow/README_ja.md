# @hierarchidb/simulation-workflow

最終更新: 2026-08-20

HierarchiDB のシミュレーションワークフローパッケージ。IDE-GSM シミュレーションワークフローのオーケストレーション・統合を提供する。

## YAML snapshot boundary

productionの`SimulationWorkflow.runSimulation` pathは現行folder-pluginのlegacy YAML serializerを直接呼び出し、package testはその現行動作をcoverしている。このpackageはYAML storage authorityまたはStep 4 executorではない。legacy serializerはnon-canonicalであり、Step 4 snapshot pathとして公開してはならない。

dormantな`@hierarchidb/simulation-workflow/canonical-yaml-snapshot` subpathは、activation前の回帰用に`CanonicalYamlSnapshotWorkflow`を提供する。export slotはcommittedに固定し、validationと決定的ZIP生成を`@hierarchidb/folder-plugin/canonical-yaml-zip-plan`へ委譲し、planning成功後だけ`importProject`を開始する。planningまたはtaskの失敗時はretryやlegacy fallbackを行わず停止する。public methodはimport archiveまたはIDE-GSM export payloadを返さずに完了する。

このsubpathはpackage rootから再exportせず、現行`runSimulation` routingを維持したままproductionから到達不能に保つ。Step 4 executorやstorage connectorではなく、dormantなactivation dependencyである。

single activation変更の開始時にlegacy SimulationWorkflow routeをfenceし、dormant canonical consumerは非公開のままにする。production routingがcanonical consumerを公開できるのは、CoreDB migrationのcommitとCoreDB initializationがともに成功した後だけである。migrationがblockedまたは失敗した場合はどちらのrouteも公開せず、legacy serializerへfallbackしない。non-SSH integrationへ進む前に、別のpost-activation regressionでproduction routeを検証する。[正規YAML storage契約](../../docs/yaml-plugin-ide-gsm-step4-spec.md)と[folder legacy boundary](../../plugins/folder-plugin/README_ja.md#legacy-yaml-snapshot-boundary)を参照する。

## 依存関係

`@hierarchidb/ide-gsm-client`, `@hierarchidb/folder-plugin`

## 関連パッケージ

- [`@hierarchidb/ide-gsm-client`](../ide-gsm-client/) — IDE-GSM クライアント
- [`@hierarchidb/folder-plugin`](../../plugins/folder-plugin/) — 現行legacy YAML serializer依存

## ライセンス

MIT
