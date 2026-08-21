# @hierarchidb/simulation-workflow

最終更新: 2026-08-21

IDE-GSM integration向けのsimulation workflow orchestrationを提供する。

## Canonical YAML snapshot path

productionの`SimulationWorkflow.runSimulation()`はCoreDB `TreeNode` snapshotを受け取り、export slotをcommittedへ固定し、validationと決定的ZIP生成を`@hierarchidb/folder-plugin/canonical-yaml-zip-plan`へ委譲する。完全なsnapshot planが成功した後だけ`importProject`を開始する。

固定sequenceはimport、calibrate、simulate、exportである。planning、task、task ID、progress callbackのいずれかが失敗した時点でsanitized errorとして停止する。retry、legacy serializerへのfallback、endpoint errorの露出を行わず、import archiveやIDE-GSM export payloadも返さない。戻り値は`Promise<void>`である。

旧`canonical-yaml-snapshot` subpathと旧root serializerはsingle canonical activationで削除した。canonical runtime accessはorigin-wide coordinatorとCoreDB readiness契約でgateされる。[正規YAML storage契約](../../docs/yaml-plugin-ide-gsm-step4-spec.md)を参照する。

## 依存関係

`@hierarchidb/ide-gsm-client`, `@hierarchidb/folder-plugin`

## 関連パッケージ

- [`@hierarchidb/ide-gsm-client`](../ide-gsm-client/) — IDE-GSM client
- [`@hierarchidb/folder-plugin`](../../plugins/folder-plugin/) — canonical YAML ZIP planner

## ライセンス

MIT
