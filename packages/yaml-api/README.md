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

## Canonical validation boundary

`@hierarchidb/yaml-api/validation` is a separate canonical-only export entry. `validateYamlCanonicalPayload(filename, payload)` validates the complete filename, subtype, schema ID, and content tuple against the registry and current JSON Schemas, then returns a newly constructed validated payload value.

The facade rejects legacy, mixed, incomplete, unknown, accessor-backed, and non-plain payloads. It parses YAML 1.2 as exactly one plain mapping and applies strict Ajv validation without coercion, defaults, property removal, or undeclared schema constraints. Stable errors contain only safe codes and field/reason context; raw payloads, YAML content, parser details, and thrown getter or proxy messages are never returned.

The neutral implementation remains package-internal. The migration subpath uses an internal adapter over the same kernel so its existing legacy classification, error precedence, ordering, and redaction remain unchanged. The package root does not re-export validation and does not load Ajv, YAML, migration, or validation modules.

## Storage authority and migration boundary

The canonical storage contract is defined in [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md):

- CoreDB `TreeNode.metadata/data` is the only authoritative committed store.
- CoreDB `TreeNode.draftMetadata/draftData` is the only authoritative draft store.
- The independent YamlDB v1 is a frozen, non-authoritative legacy recovery source. It is not a cache or a dual-write target.
- CoreDB migration and YamlDB inventory/recovery use separate atomic boundaries because they are separate IndexedDB databases.
- Missing legacy names, empty schema IDs, unknown tuples, and conflicts are reported as errors. Consumers must not infer or supply contract values.

The current `YamlFileNodeData` type remains a legacy runtime shape until the coordinated writer and storage migration issues cut over all consumers. Its presence does not make YamlDB authoritative.

## Dormant migration planner

`@hierarchidb/yaml-api/migration` is a separate export entry for the pure, read-only CoreDB YAML migration planner. It is intentionally not re-exported from the package root and is not connected to CoreDB, Dexie, workers, plugin preload, or any production reader or writer.

The caller supplies raw YAML node candidates, an explicit migration ID and CoreDB version pair, and a SHA-256 digest port. The planner never reads or writes storage, chooses a version, generates a migration ID, or falls back to a different digest. A single invalid record or digest failure returns only a sanitized error report and never a partial plan.

Each raw candidate must expose its node version as an own data property containing a non-negative safe integer. The success plan carries a deterministic source/node/version guard for every candidate. A later activation coordinator must retain the same immutable raw snapshot privately and compare the complete raw slot state again in the versionchange transaction; the planner does not persist, serialize, or log that snapshot.

YAML content validation uses the constraints declared by the current `YAML_SCHEMAS` revision with strict Ajv options. It does not add undeclared required properties or a global `additionalProperties: false` rule. The explicit strictness of the `rsync.yml` and `git.yml` schemas remains authoritative.

## Dependencies

- `@hierarchidb/core-types`
- `ajv`
- `yaml`

## Related packages

- [`@hierarchidb/yaml-store`](../yaml-store/) — legacy YamlDB v1 recovery boundary; not the authoritative runtime store
- [`@hierarchidb/core-types`](../core-types/) — shared type definitions

## License

MIT
