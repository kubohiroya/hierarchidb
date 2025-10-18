# Flow 3: Worker Initialization for a Specific Plugin

```mermaid
sequenceDiagram
    participant UI as UI Shell (React component)
    participant Registry as PluginRegistry
    participant WorkerCtl as WorkerController
    participant Worker as Plugin Worker (WebWorker)
    participant Factory as register<Plugin>WorkerStores

    UI->>Registry: request worker client for nodeType
    alt cached client exists
        Registry-->>UI: return existing WorkerClientRef
    else
        Registry->>WorkerCtl: createWorker(nodeType)
        WorkerCtl->>Worker: new Worker(plugin/worker/entry.js)
        Worker->>Factory: execute register<Plugin>WorkerStores()
        Factory->>Worker: initialize Dexie stores / services
        Worker-->>WorkerCtl: ready event
        WorkerCtl-->>Registry: WorkerClientRef
        Registry-->>UI: WorkerClientRef
    end
    UI->>Worker: invoke API (e.g. getWorkingCopy, startBatchProcessing)
```

**Key Notes**
- Worker creation is typically lazy; the registry caches the resulting `WorkerClientRef` per `nodeType`.
- `register<Plugin>WorkerStores` is responsible for wiring Dexie stores, shared download services, etc.
- All subsequent API calls (batch control, entity CRUD) go through the worker proxy exposed by the client ref.
```
