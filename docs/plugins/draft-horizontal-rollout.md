# Draft パターン水平展開ガイド

## 目的と背景

- **なぜここまで厳格化するのか**
  - Draft に UI 状態やフラグが混在すると、Undo/Redo・Batch 処理・IndexedDB 永続化で不整合が起きやすくなる。
  - `@hierarchidb/base-plugin` で定義した `DraftDraft<TEntity>` を全プラグインで共通利用すれば、型安全性・更新ロジック・ロールバックが一元化できる。
  - Basemap / Location で導入した「Draft = DraftDraft + エンティティ部分スナップショット」という構造を横展開することで、テスト・リファクタ・ドキュメントの重複を削減する。

- **このガイドの読み手**
  - プラグイン担当エンジニア（Basemap/Location/Shape/Route/Resolver 等）
  - Draft を利用する UI 開発者、Batch API 担当者
  - ドキュメント/QA 担当者（DoD チェック用）

## コア原則（What）

1. **Draft は完全なエンティティの Draft**
   - `DraftDraft<TEntity>` が保持するのは `treeNodeId` と `draft`（`Partial<TEntity>`）、`createdAt` / `updatedAt` / `originalVersion`。
   - UI 状態（Wizard 進行度、フィルタ）や一時フラグは React state / URL / in-memory adapter に移動させ、Draft に入れない。

2. **Draft 型は「Draft + Partial<TEntity>」の合成で表現する**
   - 例: `type ResolverDraftEntity = DraftDraft<ResolverEntity> & Partial<ResolverEntity>;`
   - Draft payload に最低限必要なフィールド（例: Basemap の `mapStyle` / `displayOptions`）は必須として型で保証する。

3. **ハンドラーは `createDraftDraftBase` を唯一のエントリとする**
   - Draft 作成時は必ず `createDraftDraftBase` を呼び、`meta.treeNodeId` とタイムスタンプをセットする。
   - 更新は `markDraftUpdated` を通じて `updatedAt` を一元的に管理する。

4. **Dexie 保存キーは `treeNodeId` に統一**
   - `draftTable.put(draft, draft.treeNodeId);`
   - 旧構造で保持していた `id` / `nodeId` などの余剰キーは削除する。

## 適用手順（How）

| ステップ | 内容 | 成功条件 |
| --- | --- | --- |
| 1. 現状棚卸し | ターゲットプラグインの Draft 型・ハンドラー・UI を洗い出し、余剰フィールドや UI 状態混入箇所を列挙する。 | 影響ファイル一覧と除去対象フィールドをドキュメント化（TASKS.md / 運用ログ）。 |
| 2. 型定義更新 | `types/*` ファイルで `DraftDraft<TEntity>` と `Partial<TEntity>` を合成した型を定義し、Draft payload を最小限に再設計する。 | TypeScript の型エラーがなく、Draft payload に必要フィールドが明示される。 |
| 3. ハンドラー整備 | `createDraft` / `commitDraft` / `discardDraft` を新型に合わせて調整。`treeNodeId` ベースで Dexie 操作を統一。 | `pnpm --filter <plugin> typecheck` が成功し、Diff に `treeNodeId` 以外のキー保存が残っていない。 |
| 4. UI 更新 | フォーム/ステップコンポーネントが Draft を直接 mutate せず、`Partial<TEntity>` の更新関数を介して `markDraftUpdated` と整合するようにする。 | フォームコンポーネントの Props が `Partial<TEntity>` ベースへ揃い、暗黙 any が消える。 |
| 5. 検証 | `typecheck` / `build` / 主要テスト（Vitest/WFL/E2E）が成功することを確認し、TASKS にログを残す。 | 失敗時はログに `blocked:` を残し、原因と暫定措置を明記。 |
| 6. ドキュメント | プラグイン README または共通 Docs に変更点・ロールバック手順を追記。 | Release ノート / Docs が更新され、影響範囲が共有される。 |

## 「なぜ」この手順が必要か

- **型定義から着手する理由**: Draft を中心に据えた再設計では、型が枠組みになる。先に型を合わせるとエディタ補完やコンパイラが残差箇所を教えてくれる。
- **Dexie キー統一の意義**: IndexedDB で Draft を参照する際の主キー揺らぎを防ぎ、Undo/Redo で意図しない Draft が読み込まれる事故を防ぐ。
- **UI 更新を後段に置く理由**: Handler と型の整合性がとれてから UI をまとめて変えることで、段階的に小さな diff を積みながらも整合性を保てる。

## 水平展開チェックリスト

- [ ] Draft payload から UI 専用フィールドを排除したか。
- [ ] `DraftDraft<TEntity>` と `Partial<TEntity>` の合成型が定義されているか。
- [ ] Handler が `createDraftDraftBase` / `markDraftUpdated` を利用しているか。
- [ ] Dexie 操作で `treeNodeId` 以外のキーを使っていないか。
- [ ] UI コンポーネントが `Partial<TEntity>` を props として受け、暗黙 any が残っていないか。
- [ ] `pnpm --filter <plugin> typecheck` と `build` を実行し、結果を TASKS に記録したか。
- [ ] ロールバック手順（差分 revert + typecheck 再実行）が記述されているか。

## ロールバック方針

1. `types/` と `handlers/` の差分を revert。
2. `pnpm --filter <plugin> typecheck` を再実行して従来の構成でグリーンに戻ることを確認。
3. Docs/README の記述を backout し、TASKS にロールバック記録を追加。

## 参考リンク

- `packages/plugins/base-plugin/src/draft/helpers.ts`
- `docs/plugins/draft-baseline.md`
- `packages/plugins/basemap-plugin/src/types/BaseMapEntity.ts`
- `packages/plugins/resolver-plugin/src/types/RuntimeWorkerService.ts`

