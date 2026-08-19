# @hierarchidb/simulation-workflow

Last updated: 2026-08-20

Simulation workflow package for HierarchiDB. Provides IDE-GSM simulation workflow orchestration and integration.

## YAML snapshot boundary

The production `SimulationWorkflow.runSimulation` path currently calls the folder-plugin's legacy YAML serializer directly, and the package tests cover that current behavior. This package is not a YAML storage authority or the Step 4 executor. The legacy serializer is non-canonical and must not be published as the Step 4 snapshot path.

After CoreDB migration, canonical dialog writer, and canonical folder ZIP cutover are complete, a separate issue must update and verify this consumer before non-SSH integration. See the [canonical YAML storage contract](../../docs/yaml-plugin-ide-gsm-step4-spec.md) and the [folder legacy boundary](../../plugins/folder-plugin/README.md#legacy-yaml-snapshot-boundary).

## Dependencies

`@hierarchidb/ide-gsm-client`, `@hierarchidb/folder-plugin`

## Related Packages

- [`@hierarchidb/ide-gsm-client`](../ide-gsm-client/) — IDE-GSM client
- [`@hierarchidb/folder-plugin`](../../plugins/folder-plugin/) — current legacy YAML serializer dependency

## License

MIT
