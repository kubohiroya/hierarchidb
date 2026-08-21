# @hierarchidb/simulation-workflow

Last updated: 2026-08-21

Simulation workflow orchestration for the IDE-GSM integration.

## Canonical YAML snapshot path

The production `SimulationWorkflow.runSimulation()` path accepts CoreDB `TreeNode` snapshots, fixes export to the committed slot, and delegates validation and deterministic ZIP construction to `@hierarchidb/folder-plugin/canonical-yaml-zip-plan`. It starts `importProject` only after the complete snapshot plan succeeds.

The fixed sequence is import, calibrate, simulate, then export. Planning, task, invalid task-ID, or progress-callback failure stops the sequence with a sanitized error. The method does not retry, fall back to a legacy serializer, expose endpoint errors, or return the imported archive or IDE-GSM export payload; it resolves as `Promise<void>`.

The former `canonical-yaml-snapshot` subpath and legacy root serializer were removed during the single canonical activation. Canonical runtime access remains gated by the origin-wide coordinator and CoreDB readiness contract. See the [canonical YAML storage contract](../../docs/yaml-plugin-ide-gsm-step4-spec.md).

## Dependencies

`@hierarchidb/ide-gsm-client`, `@hierarchidb/folder-plugin`

## Related Packages

- [`@hierarchidb/ide-gsm-client`](../ide-gsm-client/) — IDE-GSM client
- [`@hierarchidb/folder-plugin`](../../plugins/folder-plugin/) — canonical YAML ZIP planner

## License

MIT
