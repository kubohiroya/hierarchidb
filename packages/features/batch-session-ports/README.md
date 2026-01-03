# @hierarchidb/batch-session-ports

Layer 0 の共通パッケージです。

目的: batch/session 系の実装を **型/ポート（interface）** に分離し、
plugin（shape/location/route）や orchestrator（共通）から、
永続化実装（TaskRegistry/ArtifactStore/metadata）を差し替え可能にします。

- ここには「実装」は置きません（Dexie/Comlink/API 呼び出し等は持ち込まない）。
- 依存は `@hierarchidb/common-types` 程度に留めます。

## 提供するもの（方針）

- `StageControls` / `StageControlsFactory` 相当の最小型（必要なら）
- `TaskRegistryPort`（register/resolve/load inputs）
- `ArtifactStorePort`（put/get/list buffers）
- `ProgressInfoBase`（最小進捗 shape）

詳細な共通化計画は `docs/refactoring-plan-shape-to-location-route.md` を参照。

