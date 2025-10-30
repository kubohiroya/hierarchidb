# @hierarchidb/feature-core

Aggregated facade for feature/data packages that the app shell consumes. The overall
rationale and grouping is documented in `docs/architecture/app-dependency-bundles.md`.

Import from the following sub-paths instead of depending on the original packages
directly:

- `@hierarchidb/feature-core/common-api`
- `@hierarchidb/feature-core/common-auth`
- `@hierarchidb/feature-core/common-types`
- `@hierarchidb/feature-core/util`
- `@hierarchidb/feature-core/runtime-client`
- `@hierarchidb/feature-core/runtime-worker`
- `@hierarchidb/feature-core/map-adapter`
- `@hierarchidb/feature-core/plugin-presentation`
- `@hierarchidb/feature-core/plugin-registry`
- `@hierarchidb/feature-core/plugin-registry/derivations`
- `@hierarchidb/feature-core/plugin-registry/types`
- `@hierarchidb/feature-core/plugin-ui-sdk`
- `@hierarchidb/feature-core/basemap-plugin`
- `@hierarchidb/feature-core/folder-plugin`
- `@hierarchidb/feature-core/linker-plugin`
- `@hierarchidb/feature-core/location-plugin`
- `@hierarchidb/feature-core/resolver-plugin`
- `@hierarchidb/feature-core/route-plugin`
- `@hierarchidb/feature-core/shape-plugin`
- `@hierarchidb/feature-core/spreadsheet-plugin`
- `@hierarchidb/feature-core/styler-plugin`
- `@hierarchidb/feature-core/tabular-source-xlsx`
- `@hierarchidb/feature-core/timeline-plugin`

`FeatureCorePackages` in the root export lists every bundled module for tooling checks.
