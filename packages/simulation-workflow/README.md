# @hierarchidb/simulation-workflow

Last updated: 2026-08-20

Simulation workflow package for HierarchiDB. Provides IDE-GSM simulation workflow orchestration and integration.

## YAML snapshot boundary

The production `SimulationWorkflow.runSimulation` path currently calls the folder-plugin's legacy YAML serializer directly, and the package tests cover that current behavior. This package is not a YAML storage authority or the Step 4 executor. The legacy serializer is non-canonical and must not be published as the Step 4 snapshot path.

The dormant `@hierarchidb/simulation-workflow/canonical-yaml-snapshot` subpath now provides `CanonicalYamlSnapshotWorkflow` for pre-activation regression. It fixes export to the committed slot, delegates validation and deterministic ZIP creation to `@hierarchidb/folder-plugin/canonical-yaml-zip-plan`, and starts `importProject` only after planning succeeds. Planning or task failure stops the workflow without retry or legacy fallback. The public method resolves without returning either the imported archive or the IDE-GSM export payload.

The subpath is not re-exported from the package root and must remain unreachable from production while the current `runSimulation` routing stays unchanged. It is a dormant activation dependency, not the Step 4 executor or a storage connector.

At the start of the single activation change, the legacy SimulationWorkflow route is fenced and the dormant canonical consumer remains unpublished. Production routing may publish the canonical consumer only after the CoreDB migration commits and CoreDB initialization succeeds. If migration is blocked or fails, neither route is published, and the runtime must not fall back to the legacy serializer. A separate post-activation regression must verify the production route before non-SSH integration. See the [canonical YAML storage contract](../../docs/yaml-plugin-ide-gsm-step4-spec.md) and the [folder legacy boundary](../../plugins/folder-plugin/README.md#legacy-yaml-snapshot-boundary).

## Dependencies

`@hierarchidb/ide-gsm-client`, `@hierarchidb/folder-plugin`

## Related Packages

- [`@hierarchidb/ide-gsm-client`](../ide-gsm-client/) — IDE-GSM client
- [`@hierarchidb/folder-plugin`](../../plugins/folder-plugin/) — current legacy YAML serializer dependency

## License

MIT
