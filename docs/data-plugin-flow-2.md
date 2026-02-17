# Flow 2: Building the Plugin Menu

```mermaid
sequenceDiagram
    participant Registry as PluginRegistry
    participant MenuSvc as MenuBuilder
    participant Manifest as PLUGIN_MANIFEST
    participant UI as Navigation Menu

    MenuSvc->>Registry: getRegisteredPlugins()
    Registry-->>MenuSvc: array of plugin metadata (id, nodeType, priority, icon, category)
    loop each plugin
        MenuSvc->>Manifest: read displayName, icon, category, capability flags
        Note over MenuSvc: Filter by feature flag / capability (e.g. supportsMenuItem)
        MenuSvc->>UI: append MenuItem { label, icon, route, permissions }
    end
    UI->>User: render menu grouped by category / priority
```

**Key Notes**
- Menu builder filters plugins based on capability flags (e.g., `canBeRoot`, `supportsBuildProcessing`).
- Sorting typically uses `priority` from the manifest so core plugins appear first.
- Additional conditions (feature flags, tenant configuration) can enable/disable menu entries dynamically.
```
