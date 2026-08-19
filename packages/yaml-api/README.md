# @hierarchidb/yaml-api

Last updated: 2026-08-19

Pure type and validation contracts shared by the YAML plugin and its storage and execution consumers.

## Canonical IDE-GSM contract

The package exports:

- the exact 12-value `YamlSubtype` union;
- `YAML_SUBTYPE_REGISTRY`, the single source for subtype, schema ID, canonical filename, and command capabilities;
- the 20 local-command to pinned GraphQL-mutation mappings derived from that registry;
- `YAML_CANONICAL_TEMPLATES`, the complete 12-template contract;
- strict validators that throw `YamlContractError` for unknown or mismatched contract values;
- JSON Schemas for all registered schema IDs, including strict `rsync.yml` and `git.yml` schemas.

The registry deliberately assigns empty command capabilities to `scenario-base`, `calib`, `remote-base`, `ssh-base`, and `ec2-base`. Unknown subtype, command, schema ID, or filename values are errors; callers must not choose a default or alias.

## Current runtime boundary

Issue #1266 only introduces the pure API contract. It does not migrate stored data or change runtime consumers:

- `YamlFileNodeData` temporarily retains its existing `name`, `schemaId`, and `content` shape.
- `YAML_TEMPLATES` remains the existing 10-template list consumed by the three-step UI.
- `YAML_CANONICAL_TEMPLATES` is the new 12-template contract for later cutover work.
- `findYamlTemplate` and `getYamlSchema` retain their current non-throwing lookup behavior for existing consumers. New strict paths use the exported contract validators.

Storage migration, `metadata.name` cutover, ZIP import/export, and UI integration are tracked by follow-up issues under Epic #1162.

## Dependencies

`@hierarchidb/core-types`

## Related packages

- [`@hierarchidb/yaml-store`](../yaml-store/) — YAML data store
- [`@hierarchidb/core-types`](../core-types/) — shared type definitions

## License

MIT
