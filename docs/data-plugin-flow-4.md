# Flow 4: Opening a Plugin Dialog with Working Copy Data

```mermaid
sequenceDiagram
    participant UI as Tree UI (Menu / Node List)
    participant Dialog as Plugin Dialog Component
    participant Registry as PluginRegistry
    participant Worker as Plugin Worker

    UI->>Registry: get dialog component for nodeType
    Registry-->>UI: lazy-loaded React component factory
    UI->>Dialog: render { mode, nodeId, parentId }
    Dialog->>Registry: useWorkingCopy.init(nodeType, mode, nodeId, parentId)
    Registry->>Worker: getWorkingCopyAPI()
    alt mode == 'edit'
        Worker->>Worker: fetch working copy by nodeId (entity + metadata)
        Worker-->>Registry: serialized working copy payload
    else mode == 'create'
        Worker->>Worker: createDraftWorkingCopy(nodeType, parentId)
        Worker-->>Registry: initial draft payload
    end
    Registry-->>Dialog: map payload via `mapFromWorker`
    Dialog->>Dialog: set local state (form fields, step validation)
    Dialog->>UI: display with populated initial values
```

**Key Notes**
- `useWorkingCopy` encapsulates the worker call sequence; dialogs provide `mapFromWorker` to translate payloads into UI-friendly state.
- Modes `create`/`edit` are handled by the worker API (`createDraftWorkingCopy`, `getWorkingCopy`).
- After the dialog is closed with success, `useWorkingCopy.commit()` pushes updates back to the worker before the node list refreshes.
```
