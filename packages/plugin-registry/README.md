# @hierarchidb/plugin-registry

Last updated: 2026-04-05

A registry package that aggregates all HierarchiDB plugins and auto-generates module loaders (UI / Worker / Icon / Database) and `PluginDefinition` arrays. At build time, the code generation tool (`tools:gen-plugin-registry`) outputs registry code under `generated/`, and the application accesses all plugins through this package.

## Key Features

- Aggregated `pluginDefinitions` from all plugin `PluginManifest` entries
- Lazy loaders for UI / Worker / Icon / Database modules
- `PluginRegistryEntry` → `PluginDefinition` conversion (`derivePluginDefinitions`)
- Module specifier extraction (`derivePluginModuleSpecifiers`)

## Export Entry Points

| Path | Contents |
| --- | --- |
| `@hierarchidb/plugin-registry` | Main registry (all plugin entries) |
| `@hierarchidb/plugin-registry/ui-loaders` | UI module lazy loaders |
| `@hierarchidb/plugin-registry/worker-loaders` | Worker module lazy loaders |
| `@hierarchidb/plugin-registry/icon-loaders` | Icon module lazy loaders |
| `@hierarchidb/plugin-registry/database-loaders` | Database module lazy loaders |
| `@hierarchidb/plugin-registry/plugin-definitions` | PluginDefinition array |
| `@hierarchidb/plugin-registry/types` | Type definitions (PluginRegistryEntry, etc.) |
| `@hierarchidb/plugin-registry/derivations` | Conversion utilities |

## Build Process

```text
pnpm --workspace-root run tools:gen-plugin-registry
  → Generates registry code under generated/
  → tsdown bundles to dist/
```

The registry is built after all plugins have been built (dependency order guaranteed by Turbo pipeline).

## Dependencies

Directly depends on all 11 plugins:

basemap, folder, linker, location, resolver, route, shape, spreadsheet, styler, timeline (+ yaml-plugin may not be registered in package.json yet)

## Directory Structure

```text
generated/          # Auto-generated registry code (by tools:gen-plugin-registry)
├── registry.ts
├── types.ts
├── derivations.ts
├── ui-loaders.ts
├── worker-loaders.ts
├── icon-loaders.ts
├── database-loaders.ts
└── plugin-definitions.ts
src/
├── derivations.ts  # derivePluginDefinitions, derivePluginModuleSpecifiers
└── types.ts        # PluginRegistryEntry, PluginIconConfig, PluginCapabilities
```

## Related Packages

- [`@hierarchidb/plugin-base`](../plugin-base/) — PluginManifest type definitions
- [`@hierarchidb/core-types`](../core-types/) — Shared types (NodeType, etc.)
- All plugins (`plugins/*`) — Registry input sources

## License

MIT
