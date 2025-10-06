# Working Copy Refactor Plan

_最終更新: 2025-10-06_

## 現状整理

- `WorkingCopyBase<TEntity>` は `draft: Partial<TEntity>` を保持しつつ、`WorkingCopyDraft<TEntity>` が `WorkingCopyBase<TEntity> & Partial<TEntity>` という型合成になっている。
- `markWorkingCopyUpdated` は `draft` とトップレベルの両方に同じフィールドを展開するため、利用側では `workingCopy.name` と `workingCopy.draft.name` が併存する。
- UI や handler で `workingCopy.foo` を直接参照している箇所が多数存在し、UI 状態が WorkingCopy へ紛れ込む要因になっている。
- `draft` のみを正とする設計に移行することで、Working Copy に保持する値を明確にし、UI 状態を切り離しやすくする狙い。

### 既存使用状況サマリ

| プラグイン | 主なフィールド参照 | 備考 |
| --- | --- | --- |
| location | `workingCopy.selectionMatrix`, `workingCopy.dataSource`, `workingCopy.licenseAgreement`, `workingCopy.concurrentDownloads` | TanStack Router 移行済み。UI はトップレベル参照依存。 |
| route | `workingCopy.name`, `workingCopy.routeType`, `workingCopy.transportModes`, `workingCopy.version`, `workingCopy.waypoints` | ダイアログ各ステップで直接参照。 |
| basemap | Handler と tests が `workingCopy.name`, `workingCopy.mapStyle`, `workingCopy.viewport`, `workingCopy.tags` 等を参照。 | |
| shape | UI／Worker API／docs で `workingCopy.checkboxState`, `workingCopy.dataSourceName`, `workingCopy.processingConfig` などを利用。 | |
| resolver | Handler が `workingCopy.draft` とトップレベルの混在利用。 | |

## 改修方針

1. **型定義の見直し**
   - `WorkingCopyDraft<TEntity>` を `WorkingCopyBase<TEntity>` 単体に変更し、トップレベルへ `Partial<TEntity>` を展開しない。
   - `draft` を透過的に扱いたい場合は `createWorkingCopyProxy`（仮）などの補助関数を検討。

2. **ヘルパー更新**
   - `createDraftWorkingCopyBase` は現状どおり `draft` とメタ情報を返す。
  - `markWorkingCopyUpdated` は `draft` のみを更新し、戻り値を `WorkingCopyBase<TEntity>` とする方向で再設計。

3. **移行戦略**
   1. 現状棚卸し（本ドキュメント）
   2. プラグイン別に `workingCopy.*` → `payload.draft.*` へ置換
   3. テスト／ドキュメント更新
   4. 基盤型の切り替え（型エラーで残存箇所を排除）

## プラグイン別の主な参照箇所（2025-10-06 時点）

- **Location**
  - `components/steps/LocationSelectionStep.tsx`: `workingCopy.selectionMatrix`
  - `ui/components/LocationDetailsStep.tsx`: `workingCopy.dataSource`, `workingCopy.concurrentDownloads`, `workingCopy.licenseAgreement`
- **Route**
  - `components/RouteBasicInfoStep.tsx`: `workingCopy.name`, `workingCopy.routeType`, `workingCopy.transportModes`, `workingCopy.version`
  - `components/RouteProcessingStep.tsx`: `workingCopy.waypoints`, `workingCopy.version`
  - `components/RouteSelectionStep.tsx`: `workingCopy.version`, `workingCopy.waypoints`
- **Shape**
  - Docs（`docs/WORKING_COPY_PATTERN.md`, `docs/IMPLEMENTATION_PLAN.md`）のサンプル多数
  - `components/steps/Step*.tsx`: `workingCopy.name`, `workingCopy.dataSourceName`, `workingCopy.checkboxState`, `workingCopy.licenseAgreement`
  - `worker/api.ts` / `shared/utils.ts`: `workingCopy.batchSessionId`, `workingCopy.processingConfig`
- **Basemap**
  - `handlers/BaseMapEntityHandler.ts`: `workingCopy.name`, `workingCopy.mapStyle`, `workingCopy.viewport`, `workingCopy.tags`, `workingCopy.displayOptions`
  - テスト: `workingCopy.isDraft`, `workingCopy.nodeId` など
- **Resolver**
  - `handlers/ResolverEntityHandler.ts`: `workingCopy.draft`, `workingCopy.treeNodeId`
  - テスト: 主に `workingCopy.draft.*` 参照

## 今後のタスク案

1. Location: UI/handler の `workingCopy.*` を `payload.draft` ベースへ段階的に移行。
2. Route: ダイアログステップ（BasicInfo/Processing/Selection）を `payload.draft` 参照に書き換え、バリデーションロジックも整理。
3. Shape: UI・Worker API を `draft` 参照へ統一し、ドキュメントのサンプルも更新。
4. Basemap/Resolver: Handler とテストを `draft` 参照へ寄せる。
5. Runtime Worker: `WorkingCopyTreeNodeOperations` などコアサービスの `workingCopy.*` 参照を見直す。
6. Docs: `docs/plugins/working-copy-baseline.md` など共有ドキュメントのサンプルコードを刷新。
7. 基盤更新: `WorkingCopyDraft` 型と `markWorkingCopyUpdated` 実装を置き換え、ユニットテストを修正。

## メモ

- `useWorkingCopy` hook（runtime-ui/plugin-dialog）に draft を抽出するセレクタを用意し、UI から `draft` を直接扱う流れに誘導する案を検討中。
- `markWorkingCopyUpdated` の戻り値を `WorkingCopyBase` に変更すると、トップレベル参照が型エラーで浮き彫りになるため、事前の `draft` 化が重要。
- Worker API では `workingCopy.batchSessionId` などを参照しているため、`payload.draft` に整理する際に Worker 側の型整合性チェックが必要。
