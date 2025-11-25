# Flow 1: Discovering, Registering, and Initializing Plugins During App Startup

```mermaid
sequenceDiagram
    participant Build as tools:gen-plugin-registry
    participant AppPkg as app/package.json
    participant RegistryFile as packages/plugin-registry/generated/registry.ts
    participant Host as App Bootstrap (runtime)
    participant Registry as PluginRegistry
    participant PluginPkg as plugins/*-plugin/src/preconnect.ts
    participant Manifest as plugins/*-plugin/src/plugin-manifest.ts
    participant Runtime as RuntimeWiring (optional)
    participant WorkerFactory as worker-factory/register*WorkerStores (optional)

    Build->>AppPkg: read dependencies matching "@hierarchidb/*-plugin"
    Build->>RegistryFile: emit canonical registry (metadata + module specifiers)
    Note over RegistryFile: auto-generated and committed

    Host->>Registry: import pluginRegistry + derivations
    loop each plugin nodeType in derived UI order
        Registry->>PluginPkg: dynamic import(entry.modules.ui.specifier)
        PluginPkg->>Manifest: re-export PLUGIN_MANIFEST
        Manifest-->>Registry: plugin metadata (id, nodeType, capabilities, dependencies)
        alt Runtime wiring exported
            PluginPkg->>Runtime: invoke RuntimeWiring.register*( )
        end
        alt Worker factory exported
            PluginPkg->>WorkerFactory: register*WorkerStores( )
        end
        Registry-->>Registry: persist plugin metadata
    end
    Host->>Registry: finalize registry and notify UI shell
```

**Key Notes**
- 対象プラグインは `pnpm run tools:gen-plugin-registry`（`scripts/generate-plugin-loader.mjs` 経由）で `app/package.json` の `@hierarchidb/*-plugin` 依存から収集し、結果を **単一の正典ファイル** `packages/plugin-registry/generated/registry.ts` に書き出します。旧 `app/src/generated/*` 系ファイルは廃止済みです。
- アプリ起動時は `@hierarchidb/plugin-registry` を import し、派生ユーティリティ（`derivePluginModuleSpecifiers` など）で UI / Worker 向けのモジュール解決マップを構築します。これにより Vite/Rollup は常に静的な module specifier を扱えます。
- プラグインが提供するランタイム初期化処理（`RuntimeWiring` 等）や Worker ストア登録（`register*WorkerStores`）は、この登録時に呼び出されます。
```
