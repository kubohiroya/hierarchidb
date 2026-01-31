# Basemap Dialog Flow

TreeNode payload/draft が唯一のソースであり、Dexie `peerEntities` は廃止済み。Basemap ダイアログでは UI 側の state と runtime-worker の Draft API が以下の順序で連携する。

## Create Flow

```mermaid
sequenceDiagram
    participant User as UI (Basemap Dialog)
    participant React as React State (basicInfo, steps)
    participant Local as browser localStorage ("zxy")
    participant Comlink as Worker Bridge (usePluginDialogController)
    participant Worker as runtime-worker (DraftService)
    participant CoreDB as CoreDB TreeNode (payload/draft)

    User->>Comlink: openCreateDialog(parentId, nodeType="basemap")
    Comlink->>Worker: createDraftDraft
    Worker->>CoreDB: createDraft + resolveDefaultNodeName
    CoreDB-->>Worker: holder + draft snapshot
    Worker-->>Comlink: Draft snapshot (TreeNode.draft/payload)
    Comlink-->>React: hydrate basic info / steps

    React->>Local: read "zxy" (if present)
    React->>Comlink: mergeDraft(draft.viewport) when localStorage value exists
    Comlink->>Worker: updateDraft
    Worker->>CoreDB: update draft.viewport → persistTreeNodeDraft
    CoreDB-->>Worker: updated snapshot
    Worker-->>Comlink: draft w/ viewport
    Comlink-->>React: update Viewport step

    React->>Local: if no cache -> request Geolocation
    Local-->>React: coordinates or failure
    React->>Comlink: mergeDraft(viewport) using geo or fallback (0,0,2)
    Comlink->>Worker: updateDraft → CoreDB

    User->>React: Step1 input (name/description/tags)
    React->>Comlink: mergeDraft(draft{name,description}, tags)
    Comlink->>Worker: updateDraft → CoreDB
    Worker-->>Comlink: validation state
    Comlink-->>React: update Step1 validity

    User->>React: Step2 MapStyle edits
    React->>Comlink: mergeDraft(draft.mapStyle)
    Comlink->>Worker: updateDraft → CoreDB
    Worker->>Comlink: normalized BasemapPeerData (presentation)
    Comlink-->>React: Step2 filled

    User->>React: Step3 map interactions
    React->>Local: persistViewportDefaults(viewState → "zxy")
    React->>Comlink: mergeDraft(draft.viewport, uiState.viewportTouched)
    Comlink->>Worker: updateDraft → CoreDB

    User->>React: Save
    React->>Comlink: commitDraft
    Comlink->>Worker: commitDraft
    Worker->>CoreDB: promote draft → payload, create target node
    Worker-->>Comlink: CommitResult(nodeId)
    Comlink-->>React: success → close dialog and refresh tree
```

## Edit Flow

```mermaid
sequenceDiagram
    participant User as UI (Basemap Dialog)
    participant React as React State
    participant Local as browser localStorage ("zxy")
    participant Comlink as Worker Bridge
    participant Worker as runtime-worker
    participant CoreDB as TreeNode payload/draft

    User->>Comlink: openDialog(nodeId)
    Comlink->>Worker: createDraftFromNode
    Worker->>CoreDB: load payload/draft for nodeId and WC holder
    CoreDB-->>Worker: snapshot (includes presentation)
    Worker-->>Comlink: draft snapshot
    Comlink-->>React: hydrate Steps 1-3

    React->>Local: read "zxy" but prefer payload.viewport
    React->>Comlink: mergeDraft(draft.viewport) only if WC lacks viewport
    Comlink->>Worker: updateDraft (no-op when already populated)

    User->>React: edit Steps 1-3
    React->>Comlink: mergeDraft(draft{mapStyle|viewport}, ui flags)
    Comlink->>Worker: updateDraft → CoreDB
    Worker-->>Comlink: validation snapshot
    Comlink-->>React: update validity/Stepper state

    User->>React: Save
    React->>Comlink: commitDraft
    Comlink->>Worker: commitDraft (handles rename conflicts)
    Worker->>CoreDB: upsert payload, delete WC draft, sync payload for canonical node
    Worker-->>Comlink: CommitResult
    Comlink-->>React: close dialog, update tree, keep "zxy" cache in localStorage for future create flows
```

## 仕様メモ

- Basemap payload (`BasemapPeerData`) は `schemaVersion=1` と `presentation` (mapStyle / viewport) のみを保持。UI 表示用フィールド（name/description/tags）は TreeNode の top-level に存在する。
- `ViewportStep` は `window.localStorage.zxy` → Geolocation API → `[0,0] zoom 2` の順に初期状態を決める。MapLibre の view state 変更イベントで `zxy` を常にリライトする。
- DraftService は Step1/2/3 の入力を `TreeNode.draft` に書き込み、Worker 側で normalize を適用し `TreeNode.data/draftData` を更新する。PeerStore は廃止済みのため、commit 後は TreeNode の更新だけで完結する。
