# Styler Resolver Style Binding Contract

This document is the normative contract for applying style data produced by Styler nodes to map feature layers through Resolver bindings.

It covers direct Shape, Location, and Route targets for #1684, and Folder target scope semantics for #1687. Runtime source loading, Resolver persistence, and map rendering are implemented by follow-up issues.

## Scope

In scope:

- Mounted IDE-GSM result CSV sources that are exposed as mounted file nodes.
- Styler output represented as a table of key/value style rows.
- Resolver bindings from one Styler node to Shape, Location, and Route feature-producing target nodes.
- Folder targets as explicit scopes over supported descendant feature-producing nodes.
- Validation, warning, and error behavior needed by #1683, #1685, #1686, and #1688.

Out of scope:

- Copying mounted CSV files into CoreDB as local spreadsheet data.
- Inferring join keys from column names or feature properties.
- Editing mounted files.
- Storing endpoint URLs, tokens, absolute server paths, raw credentials, or raw CSV bodies in TreeNode payloads, Styler payloads, or Resolver payloads.
- Rendering unsupported target kinds.

## Data Flow

The supported flow is:

1. The IDE-GSM mount adapter exposes result CSV files as mounted TreeNode-compatible entries.
2. A Styler node stores a validated mounted CSV source reference and loads rows through the IDE-GSM mount/client boundary.
3. The Styler node produces a style table with an explicit source key column and one or more style property columns.
4. A Resolver binding references the Styler node, a target node or Folder scope, a source key column, a target key property, and selected style properties.
5. The map rendering path applies resolved style values to supported Shape, Location, and Route features.

No step may bypass the mounted client boundary by using an absolute path, endpoint URL, token, or legacy string-only directory traversal.

## Source Reference

Mounted IDE-GSM CSV source references are versioned records owned by `@hierarchidb/styler-store`.

The initial source variant must include:

- `version`: source schema version. Initial value is `1`.
- `kind`: `ide-gsm-mounted-csv`.
- `mountId`: stable mounted tree identifier.
- `sourceKind`: mounted source kind. Initial supported values are `project-root` and `fdm-space-root`.
- `projectId`: upstream IDE-GSM project identifier for `project-root` sources.
- `spaceId`: upstream IDE-GSM FDM space identifier for `fdm-space-root` sources.
- `relativePath`: logical CSV path below the mounted root.

The source reference must not include:

- GraphQL endpoint URLs.
- Access tokens, JWTs, API keys, or other credential material.
- Absolute filesystem paths on the IDE-GSM host.
- Raw CSV content.
- SSH, EC2, rsync, or container lifecycle configuration.

Existing Styler records without this source variant remain unchanged. Readers must treat the missing source field as the legacy local/spreadsheet flow and must not backfill or inject a mounted source variant implicitly.

## CSV Schema

A mounted CSV source is valid for style binding only when all of these rules pass:

- The file is selected through a mounted CSV source reference.
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
- Unsupported mounted source kind: error.
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

Mounted remote Folders:

- A mounted remote Folder is valid only when the TreeQueryAPI or mount adapter can enumerate the requested scope.
- If descendants cannot be enumerated through the mounted boundary, validation fails with `MOUNTED_FOLDER_ENUMERATION_UNAVAILABLE`.
- The resolver must not fallback to absolute paths or direct IDE-GSM filesystem traversal.

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
- `MOUNTED_FOLDER_ENUMERATION_UNAVAILABLE`

Warnings:

- `STYLE_BINDING_SOURCE_ROW_UNMATCHED`
- `STYLE_BINDING_TARGET_FEATURE_UNMATCHED`
- `STYLE_BINDING_EMPTY_STYLE_VALUE`
- `STYLE_BINDING_EMPTY_FOLDER_SCOPE`
- `STYLE_BINDING_UNSUPPORTED_DESCENDANT_SKIPPED`
- `STYLE_BINDING_ARCHIVED_DESCENDANT_SKIPPED`

Messages for these codes may include node IDs, mount IDs, source kind, and logical relative paths. They must not include raw CSV rows, endpoint URLs, tokens, absolute server paths, raw credential material, or raw mounted file contents.

## Implementation Boundaries

#1683 owns mounted CSV source references and loading in Styler.

#1685 owns Resolver persistence and validation for direct Shape, Location, and Route targets.

#1686 owns map layer application of resolved style values for direct targets.

#1688 owns Folder-scoped Resolver binding implementation after this Folder semantics section is accepted.
