# Styler Resolver Style Binding Contract

This document is the normative contract for applying style data produced by Styler nodes to map feature layers through Resolver bindings.

It covers direct Shape, Location, and Route targets for #1684, and Folder target scope semantics for #1687. Runtime source loading, Resolver persistence, and map rendering are implemented by follow-up issues.

Related node specifications:

- [idegsm-project-node-spec.md](./idegsm-project-node-spec.md)
- [fdm-node-spec.md](./fdm-node-spec.md)

## Scope

In scope:

- Explicitly synced read-only IDE-GSM tabular snapshots under an `idegsm-project` sync root that remain usable when the IDE-GSM server is disconnected.
- Path-based selection of CSV source nodes under an `idegsm-project`, with on-demand browser-local content acquisition before the Styler source is committed.
- Styler output represented as a table of key/value style rows.
- Resolver bindings from one Styler node to Shape, Location, and Route feature-producing target nodes.
- Folder targets as explicit scopes over supported descendant feature-producing nodes.
- Validation, warning, and error behavior needed by #1683, #1685, #1686, and #1688.

Out of scope:

- Inferring join keys from column names or feature properties.
- Editing disconnected synced files. Connected server-authoritative writes are governed by the `idegsm-project` sync root contract.
- Storing endpoint URLs, tokens, absolute server paths, raw credentials, or raw CSV bodies in TreeNode payloads, Styler payloads, or Resolver payloads.
- Rendering unsupported target kinds.

## Data Flow

The supported flow is:

1. Project creation materializes an `idegsm-project` hierarchy containing metadata-only CSV source nodes; it does not download all CSV bodies.
2. The Styler source picker browses that local hierarchy and selects a CSV by its `projectNodeId` plus logical path below the project root.
3. The project sync service fetches, parses, stages, and publishes that CSV as a read-only Tabular snapshot, then marks the CSV source as tracked.
4. Only after publication succeeds does the Styler node persist a reference to the committed snapshot.
5. The Styler node produces a style table with an explicit source key column and one or more style property columns.
6. A Resolver binding references the Styler node, a target node or Folder scope, a source key column, a target key property, and selected style properties.
7. The map rendering path applies resolved style values to supported Shape, Location, and Route features.

No step may bypass the synchronized Tabular boundary by using an absolute path, endpoint URL, token, or string-only directory traversal. No disconnected step may require the IDE-GSM endpoint, JWT, token, server absolute path, or raw remote file content to be stored in Styler or Resolver payloads.

The path selected by the picker is a validated logical `relativePath` resolved from the current CSV child node. It is not a free-form server path field. Selection fails before persistence when the source is outside the chosen `idegsm-project`, is no longer a current CSV child, or is metadata-only while the server is disconnected.

## Source Reference

The IDE-GSM source variant is a versioned record owned by `@hierarchidb/styler-store`. It must reference an explicit read-only Tabular snapshot created under an `idegsm-project` sync root and include:

- `version`: source schema version.
- `kind`: `ide-gsm-synced-tabular`.
- `snapshotId`: local Tabular snapshot identifier.
- `originProjectNodeId`: local `idegsm-project` sync root node identifier.
- `originContentGenerationId`: committed content generation that published the snapshot.
- `originRelativePath`: logical CSV path below the `idegsm-project` root at sync time.
- `syncedAt`: timestamp recorded by the sync operation.
- `contentDigest`: digest of the synced CSV content.

The source reference must not include:

- GraphQL endpoint URLs.
- Access tokens, JWTs, API keys, or other credential material.
- Absolute filesystem paths on the IDE-GSM host.
- Raw CSV content.
- SSH, EC2, rsync, or container lifecycle configuration.

This is the only IDE-GSM source variant in the Styler contract. Existing Styler records without it remain unchanged and continue through their existing local/spreadsheet flow; readers must not backfill an IDE-GSM source implicitly.

Synced Tabular snapshots are local read-only data with an IDE-GSM server-authoritative origin. They may be used while the IDE-GSM server is unavailable, but they are not proof that the remote CSV is still current. After first materialization, reconnection or a relevant authenticated server notification may compare `contentDigest` and publish a new synchronized generation. CSV nodes that have never been selected remain metadata-only and are not content-synchronized. Readers must not silently replace the local snapshot, infer freshness from path equality, or fall back to a remote read when a committed snapshot was requested. There is no manual refresh/resync source action in the initial contract.

Initial materialization and tracked refresh consume the IDE-GSM CSV through one short-lived immutable transfer session. Each decoded page contains at most 16 KiB of raw bytes and pages are stream-parsed in cursor order; page boundaries are not CSV row or UTF-8 character boundaries. Raw chunks, transfer IDs, and cursors are runtime-only and must not be persisted in Styler source records or Tabular snapshot metadata.

When IDE-GSM server-side CSV write support is added in a later issue, the write must go to the server first. Styler must observe the refreshed local snapshot after sync and must not mutate the synced Tabular data directly. Initial disconnected support is read-only CSV sync and visualization.

## CSV Schema

A synchronized CSV source is valid for style binding only when all of these rules pass:

- The selected path resolves to a current CSV source node under the specified `idegsm-project`.
- On-demand materialization has successfully published an explicit read-only Tabular snapshot reference.
- The parser can read the file as delimited text with a header row.
- Header names are unique after exact string comparison.
- The configured source key column exists.
- Each enabled style property references an existing column.
- Key column values are strings or numbers after parsing.
- Empty key values are invalid rows.
- Empty style values mean that property is unset for the row.

Rows with invalid keys are governed by the binding validation policy. Invalid keys are never silently converted, trimmed into another value, case-folded, rounded, or replaced by defaults.

## Join Contract

The initial join mode is exact-match only.

The Resolver binding must provide:

- `stylerNodeId`: referenced Styler node.
- `targetNodeId`: direct target node or Folder target node.
- `targetKind`: `shape`, `location`, `route`, or `folder`.
- `sourceKeyColumn`: CSV key column produced by the Styler source.
- `targetKeyProperty`: feature property used as the lookup key.
- `styleProperties`: enabled style properties to apply.
- `enabled`: whether the binding participates in resolution.

Exact-match rules:

- Source keys and target keys compare by exact primitive value after parsing.
- String comparison is case-sensitive.
- Number comparison requires the same finite numeric value.
- String and number keys do not match across types.
- Null, undefined, and empty-string keys are invalid.
- Partial matches, substring matches, case-insensitive matches, locale collation, numeric rounding, and implicit type coercion are not supported.

Cardinality:

- Multiple target features may match one source row.
- One target feature must resolve to at most one source row for a given binding.
- Duplicate source keys are validation errors by default.
- Duplicate target keys are allowed only when all matched target features receive the same style row.

## Direct Target Eligibility

Direct target bindings support only feature-producing nodes:

| Target kind | Supported node type | Style family |
| --- | --- | --- |
| `shape` | Shape nodes | polygon and multipolygon fill/outline style |
| `location` | Location nodes | point and circle style |
| `route` | Route nodes | line style |

Unsupported direct target node types are validation errors. Folder nodes are not accepted as direct feature targets; they require `targetKind: "folder"` and an explicit Folder scope mode.

## Supported Style Properties

The initial property set is intentionally narrow:

| Property | Value type | Shape | Location | Route |
| --- | --- | --- | --- | --- |
| `fillColor` | CSS color string or hex color string | supported | not supported | not supported |
| `strokeColor` | CSS color string or hex color string | supported | supported | supported |
| `strokeWidth` | finite number greater than or equal to `0` | supported | supported | supported |
| `opacity` | finite number in `0..1` | supported | supported | supported |
| `radius` | finite number greater than `0` | not supported | supported | not supported |

Unsupported style properties are validation errors. Invalid values are rejected during validation or resolution before map rendering receives them. The renderer must not clamp invalid values or substitute default colors for invalid style rows.

## Missing and Duplicate Behavior

Resolution behavior:

- Missing Styler node: error.
- Missing target node: error.
- Missing source CSV: error.
- Metadata-only IDE-GSM CSV while disconnected: error; source selection is not committed.
- On-demand CSV acquisition or publication failure: error; the previous Styler source remains unchanged.
- Missing source key column: error.
- Missing target key property: error.
- Duplicate source key: error.
- Duplicate binding ID in one Resolver payload: error.
- Multiple enabled bindings for the same direct target and same style property: conflict error unless a later schema adds explicit priority.
- Source row without a matching target feature: warning.
- Target feature without a matching source row: warning and existing layer style remains unchanged.
- Null or empty style value: non-fatal unset property for that row.

Warnings must not become implicit fallbacks. A warning permits rendering only for feature/property pairs with valid resolved style values.

## Folder Target Semantics

Folder targets are scopes, not feature-producing targets.

A Folder binding must provide:

- `targetKind`: `folder`.
- `targetNodeId`: Folder node ID.
- `scopeMode`: `direct-children` or `recursive-descendants`.
- The same source key, target key, and style property configuration as a direct target binding.

There is no default scope mode. Missing `scopeMode` is a validation error.

Scope modes:

- `direct-children`: only immediate Shape, Location, and Route children of the Folder are target candidates.
- `recursive-descendants`: Shape, Location, and Route descendants at any depth below the Folder are target candidates.

Unsupported descendants:

- Unsupported descendant node types are excluded and counted as warnings.
- Unsupported descendants do not fail the whole binding unless every candidate is unsupported.
- Archived or deleted nodes are excluded and counted as warnings when visible to the resolver boundary.
- Empty Folder scopes produce a warning and resolve to no style overrides.

Precedence:

1. Direct Shape, Location, or Route target binding.
2. Folder binding with the deepest matching Folder scope.
3. Same-depth Folder bindings conflict unless a later schema adds explicit priority.

When precedence selects a binding for a feature/property pair, lower-precedence bindings must not also apply that property.

## Error and Warning Codes

Errors:

- `STYLER_SOURCE_MISSING`
- `STYLER_SOURCE_UNSUPPORTED`
- `STYLER_SOURCE_CREDENTIALS_UNAVAILABLE`
- `STYLER_SOURCE_CONNECTION_UNAVAILABLE`
- `STYLER_SOURCE_PATH_INVALID`
- `STYLER_SOURCE_NOT_MATERIALIZED`
- `STYLER_SOURCE_ACQUISITION_FAILED`
- `STYLER_SOURCE_PUBLICATION_FAILED`
- `STYLER_SOURCE_CSV_MISSING`
- `STYLER_SOURCE_CSV_MALFORMED`
- `STYLER_SOURCE_FORBIDDEN_PUBLIC_FIELD`
- `STYLE_BINDING_MISSING_STYLER`
- `STYLE_BINDING_MISSING_TARGET`
- `STYLE_BINDING_UNSUPPORTED_TARGET_KIND`
- `STYLE_BINDING_MISSING_SOURCE_KEY`
- `STYLE_BINDING_MISSING_TARGET_KEY`
- `STYLE_BINDING_DUPLICATE_SOURCE_KEY`
- `STYLE_BINDING_DUPLICATE_BINDING_ID`
- `STYLE_BINDING_CONFLICT`
- `STYLE_BINDING_INVALID_STYLE_PROPERTY`
- `STYLE_BINDING_INVALID_STYLE_VALUE`
- `STYLE_BINDING_MISSING_FOLDER_SCOPE_MODE`
- `STYLE_BINDING_UNSUPPORTED_FOLDER_SCOPE_MODE`

Warnings:

- `STYLE_BINDING_SOURCE_ROW_UNMATCHED`
- `STYLE_BINDING_TARGET_FEATURE_UNMATCHED`
- `STYLE_BINDING_EMPTY_STYLE_VALUE`
- `STYLE_BINDING_EMPTY_FOLDER_SCOPE`
- `STYLE_BINDING_UNSUPPORTED_DESCENDANT_SKIPPED`
- `STYLE_BINDING_ARCHIVED_DESCENDANT_SKIPPED`

Messages for these codes may include local node IDs, snapshot IDs, content generation IDs, and logical relative paths. They must not include raw CSV rows, endpoint URLs, tokens, absolute server paths, raw credential material, or raw remote file contents.

## Implementation Boundaries

#1683 owns `idegsm-project` CSV path selection, on-demand content materialization, and synchronized snapshot references in Styler.

#1685 owns Resolver persistence and validation for direct Shape, Location, and Route targets.

#1686 owns map layer application of resolved style values for direct targets.

#1688 owns Folder-scoped Resolver binding implementation after this Folder semantics section is accepted.
