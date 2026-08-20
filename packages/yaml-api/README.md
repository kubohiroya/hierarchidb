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

The neutral implementation remains package-internal. The migration subpath uses an internal adapter over the same kernel for strict legacy-with-name, host-split-legacy, and canonical classification while preserving error precedence, ordering, and redaction. The canonical-only facade still rejects host-split payloads. The package root does not re-export validation or inverse migration and does not load Ajv, YAML, migration, validation, or inverse-migration modules.

## Storage authority and migration boundary

The canonical storage contract is defined in [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md):

- CoreDB `TreeNode.metadata/data` is the only authoritative committed store.
- CoreDB `TreeNode.draftMetadata/draftData` is the only authoritative draft store.
- The independent YamlDB v1 is a frozen, non-authoritative legacy recovery source. It is not a cache or a dual-write target.
- CoreDB migration and YamlDB inventory/recovery use separate atomic boundaries because they are separate IndexedDB databases.
- A missing legacy name is accepted only for the exact historical host-split payload with own data keys `schemaId` and `content`, validated against the corresponding metadata name and one registry entry. Partial payloads, empty schema IDs, unknown tuples, and conflicts are errors; consumers must not apply a general metadata fallback.

The current `YamlFileNodeData` type remains a legacy runtime shape until the coordinated writer and storage migration issues cut over all consumers. Its presence does not make YamlDB authoritative.

## Dormant migration planner

`@hierarchidb/yaml-api/migration` is a separate export entry for the pure, read-only CoreDB YAML migration planner. It is intentionally not re-exported from the package root and is not connected to CoreDB, Dexie, workers, plugin preload, or any production reader or writer.

The caller supplies raw YAML node candidates, an explicit migration ID and CoreDB version pair, and a SHA-256 digest port. The planner never reads or writes storage, chooses a version, generates a migration ID, or falls back to a different digest. A single invalid record or digest failure returns only a sanitized error report and never a partial plan.

Each raw candidate must expose its node version as an own data property containing a non-negative safe integer. The success plan carries a deterministic source/node/version guard for every candidate. A later activation coordinator must retain the same immutable raw snapshot privately and compare the complete raw slot state again in the versionchange transaction; the planner does not persist, serialize, or log that snapshot.

YAML content validation uses the constraints declared by the current `YAML_SCHEMAS` revision with strict Ajv options. It does not add undeclared required properties or a global `additionalProperties: false` rule. The explicit strictness of the `rsync.yml` and `git.yml` schemas remains authoritative.

Migration mode accepts the exact historical `{ schemaId, content }` host-split payload in addition to legacy-with-name and canonical payloads. It does not accept `{ schemaId }`, missing content, extra or symbol keys, accessors, or ambiguous registry matches. Each migrate entry and journal value carries `preimageRepresentation: legacy-with-name | host-split-legacy`; `legacyName` is the validated payload/metadata name for legacy-with-name and the validated metadata name for host-split-legacy.

## Dormant inverse migration planners

`@hierarchidb/yaml-api/inverse-migration` is a separate pure, dormant export entry. It exposes `planExactYamlCoreDbInverseMigration` and `planReleaseYamlCoreDbInverseMigration` as separate functions and types; there is no generic mode, default publication assumption, or exact-to-release fallback. The entry is not connected to CoreDB, Dexie, YamlDB, workers, feature flags, production readers, or writers.

Exact planning requires the explicit `canonical-writer-never-published` literal, the complete raw node and forward-journal snapshots, and the forward planner's SHA-256 digest port. It strictly validates the journal cohort, compound keys, node/slot presence, preimage representation, legacy name, and recomputed canonical postimage digest, and restores only journaled slots. A `legacy-with-name` entry restores exact `{ name, schemaId, content }`; a `host-split-legacy` entry restores exact `{ schemaId, content }` without adding `name`. Release planning requires explicit `canonical-writer-published-or-unknown`, does not use a journal, and restores every present slot to legacy-with-name only after all slots pass canonical validation. Both planners preserve `schemaId` and `content` byte-for-byte.

Inputs and raw snapshots are inspected through own data descriptors without running getters. Unsafe, incomplete, extra, symbol-backed, accessor-backed, duplicate, non-plain, or reflection-failing values are rejected. Success returns a deeply immutable, deterministic complete plan with node guards and, for exact planning, journal guards. Any failure returns only redacted code/context errors and no partial entries or guards.

These plans are not authorization to write. A later coordinator must bind the explicit publication requirement to runtime facts, retain the same immutable raw snapshots privately, reread and compare the complete node and journal state inside a newer CoreDB versionchange transaction, and then apply the plan all-or-none.

## Dependencies

- `@hierarchidb/core-types`
- `ajv`
- `yaml`

## Related packages

- [`@hierarchidb/yaml-store`](../yaml-store/) — legacy YamlDB v1 recovery boundary; not the authoritative runtime store
- [`@hierarchidb/core-types`](../core-types/) — shared type definitions

## License

MIT
