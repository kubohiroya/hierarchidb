# Build Session State Tree Spec (Shape UI)

Shape UI は canonical subscription/control kernel の共通仕様を採用するが、
Jotai state tree は plugin-owned の単一インスタンスを維持する。共通 kernel が
Shape 用の別 state tree を生成してはならない。

- 共通仕様本体:
  - `packages/ui/build-sessions/docs/build-session-state-tree-spec.md`

## Shape-specific stage IDs

```ts
type ShapeStageId = 'source' | 'geometry' | 'tileEmit';
```

## Shape-specific notes

- task status には `skipped` を含む。
- `counts` / `elapsed` / `remaining(est)` は root 保存せず selector で算出する。
- `stageHeartbeatAt` は状態木へ保存しない（必要な監視用途は別経路）。

## Stage transition contract (Source / Geometry / TileEmit)

Shape UI applies two-layer state:

- Worker lifecycle (`session.phase`): `idle | starting | running | ...`
- UI sync substate (`uiSyncPhase` per stage): `ui-initializing | running`

For each stage transition:

1. Detect transition by progress/session event stage (`source|geometry|tileEmit`).
2. Set target stage `uiSyncPhase='ui-initializing'`.
3. While in `ui-initializing`, buffer progress events for that stage only.
4. Accept the authoritative full stage snapshot (`stageSnapshotUpdated`).
5. Set target stage `uiSyncPhase='running'`.
6. Flush buffered `taskProgressUpdated` events through the per-task version gate.

Expected sequence for a full run:

- `idle`
- `running + source(ui-initializing -> running)`
- `running + geometry(ui-initializing -> running)`
- `running + tileEmit(ui-initializing -> running)`
- `completed`
