# @hierarchidb/simulation-workflow

最終更新: 2026-08-20

HierarchiDB のシミュレーションワークフローパッケージ。IDE-GSM シミュレーションワークフローのオーケストレーション・統合を提供する。

## YAML snapshot boundary

productionの`SimulationWorkflow.runSimulation` pathは現行folder-pluginのlegacy YAML serializerを直接呼び出し、package testはその現行動作をcoverしている。このpackageはYAML storage authorityまたはStep 4 executorではない。legacy serializerはnon-canonicalであり、Step 4 snapshot pathとして公開してはならない。

CoreDB migration、canonical dialog writer、canonical folder ZIP cutoverが完了した後、別Issueでこのconsumerを更新・検証してからnon-SSH integrationへ進む。[正規YAML storage契約](../../docs/yaml-plugin-ide-gsm-step4-spec.md)と[folder legacy boundary](../../plugins/folder-plugin/README_ja.md#legacy-yaml-snapshot-boundary)を参照する。

## 依存関係

`@hierarchidb/ide-gsm-client`, `@hierarchidb/folder-plugin`

## 関連パッケージ

- [`@hierarchidb/ide-gsm-client`](../ide-gsm-client/) — IDE-GSM クライアント
- [`@hierarchidb/folder-plugin`](../../plugins/folder-plugin/) — 現行legacy YAML serializer依存

## ライセンス

MIT
