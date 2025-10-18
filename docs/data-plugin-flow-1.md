# Flow 1: Discovering, Registering, and Initializing Plugins During App Startup

```mermaid
sequenceDiagram
    participant Build as scripts/generate-plugin-loader.mjs
    participant AppPkg as app/package.json
    participant LoaderFile as app/src/generated/ui-loader.ts
    participant Host as App Bootstrap (runtime)
    participant Registry as PluginRegistry
    participant PluginPkg as plugins/*-plugin/src/index.ts
    participant Manifest as plugins/*-plugin/src/plugin-manifest.ts
    participant Runtime as RuntimeWiring (optional)
    participant WorkerFactory as worker-factory/register*WorkerStores (optional)

    Build->>AppPkg: read dependencies matching "@hierarchidb/*-plugin"
    Build->>LoaderFile: emit import stubs (ui-loadOrder, worker loaders)
    Note over LoaderFile: generated at build time

    Host->>Registry: createPluginRegistry()
    loop each plugin nodeType in uiLoadOrder
        Registry->>PluginPkg: dynamic import("plugins/<name>-plugin/src/index.ts")
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
- どのプラグインを対象とするかは `scripts/generate-plugin-loader.mjs` が `app/package.json` の依存（`@hierarchidb/*-plugin`）から収集し、`app/src/generated/ui-loader.ts` や `app/src/generated/worker-loader.ts` といったローダーファイルに書き出します。
- アプリ起動時はそのローダーとプラグインの `index.ts` / `plugin-manifest.ts` を import し、マニフェスト情報を `PluginRegistry` に登録します。
- プラグインが提供するランタイム初期化処理（`RuntimeWiring` 等）や Worker ストア登録（`register*WorkerStores`）は、この登録時に呼び出されます。
```
