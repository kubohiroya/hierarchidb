# @hierarchidb/yaml-api

Last updated: 2026-08-20

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

## Storage authority and migration boundary

The canonical storage contract is defined in [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md):

- CoreDB `TreeNode.metadata/data` is the only authoritative committed store.
- CoreDB `TreeNode.draftMetadata/draftData` is the only authoritative draft store.
- The independent YamlDB v1 is a frozen, non-authoritative legacy recovery source. It is not a cache or a dual-write target.
- CoreDB migration and YamlDB inventory/recovery use separate atomic boundaries because they are separate IndexedDB databases.
- Missing legacy names, empty schema IDs, unknown tuples, and conflicts are reported as errors. Consumers must not infer or supply contract values.

The current `YamlFileNodeData` type remains a legacy runtime shape until the coordinated writer and storage migration issues cut over all consumers. Its presence does not make YamlDB authoritative.

## Dependencies

`@hierarchidb/core-types`

## Related packages

- [`@hierarchidb/yaml-store`](../yaml-store/) — legacy YamlDB v1 recovery boundary; not the authoritative runtime store
- [`@hierarchidb/core-types`](../core-types/) — shared type definitions

## License

MIT
