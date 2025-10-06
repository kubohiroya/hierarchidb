# Working Copy ベースラインガイドライン

本ドキュメントは、プラグイン横断で Working Copy（以下 WC と表記）の契約を統一し、編集フローを安全に保つための基準を定義する。既存コードの整理や新規プラグインの実装時は必ず本ガイドに従うこと。

## 目的
- WC を「PeerEntity の部分スナップショット」として統一し、UI 専用の一時データを混在させない。
- Dexie 上の永続データと UI の一時状態を明確に分離することで、回帰や競合を防ぐ。
- `@hierarchidb/plugins-base-plugin` が提供する共通ヘルパーを利用し、実装重複とバグ温床を排除する。

## 基本原則
- **WC は Partial<TEntity>**: `draft` プロパティにエンティティ本来の構造を `Partial` で保持する。UI での入力途中の値もすべてここに格納する。
- **メタ情報は最小限**: `WorkingCopyBase<TEntity>` が提供する `treeNodeId` / `createdAt` / `updatedAt` / `originalVersion?` のみを保持する。`isDraft` や `schemaVersion`、独自 ID などは追加しない。
- **1 ノード 1 WC**: `treeNodeId` がそのまま WC の主キーとなる。WC 専用 ID を作らない。
- **UI 一時状態は UI で管理**: ステッパーの選択状態や検索結果などは UI コンポーネント／URL パラメータに保持し、WC へは保存しない。
- **PeerStore とは責務分離**: PeerStore のデフォルト値・マイグレーションは `peer-store/*` のヘルパーで扱い、WC へは含めない。

## 必須プロパティ
| プロパティ | 型 | 説明 |
| --- | --- | --- |
| `treeNodeId` | `NodeId` | WC が紐づくツリーノード ID。Dexie の primary key として利用する。 |
| `draft` | `Partial<TEntity>` | 編集中のフィールド集合。未入力のフィールドは `undefined` のままでよい。 |
| `createdAt` | `Timestamp` | WC を生成した時刻。新規ドラフト時は現在時刻、既存エンティティ編集時は元エンティティの `createdAt` を持ち越す。 |
| `updatedAt` | `Timestamp` | 直近で WC を更新した時刻。`markWorkingCopyUpdated` で更新する。 |
| `originalVersion?` | `number` | 既存エンティティから派生した場合のオリジナル版数。新規作成時は省略可能。 |

## 推奨ヘルパーの使い方
```ts
import { createDraftWorkingCopyBase, markWorkingCopyUpdated } from '@hierarchidb/plugins-base-plugin';

const workingCopy = createDraftWorkingCopyBase<MyEntity>({
  draft: {
    name: '',
    description: undefined,
  },
  meta: {
    treeNodeId,
    createdAt: original?.createdAt,
    originalVersion: original?.version,
  },
});

const updated = markWorkingCopyUpdated(workingCopy, { name: 'New name' });
```

- `createDraftWorkingCopyBase` の `meta.treeNodeId` は必須。新規ノードの場合もツリー側で採番した ID を渡す。
- `markWorkingCopyUpdated` は `draft` とメタ情報を同時に更新する唯一の経路とする。

## 実装指針（Worker 側）
- `BaseEntityHandler` / `HierarchicalEntityHandler` を継承するクラスでは以下のメソッド契約を守る。
  - `createWorkingCopy(nodeId: NodeId)` は必ず `createDraftWorkingCopyBase` を経由して WC を生成し、Dexie の `workingCopies` テーブルに `treeNodeId` をキーとして保存する。
  - `createNewDraftWorkingCopy(nodeId: NodeId)` も同様にヘルパーを利用し、未入力フィールドは `draft` のみで表現する。
  - `commitWorkingCopy` / `discardWorkingCopy` は `draft` の内容を元にエンティティを更新・削除する。UI 専用フィールドに依存しない実装にする。
- Dexie スキーマでは WC テーブルに余計なインデックスを追加せず、`treeNodeId` を Primary Key とする。

## 実装指針（UI 側）
- WC の読み書きには `@hierarchidb/ui-core` の `useWorkingCopy` 等の既存フックを用い、`setWorkingCopy` 時は `markWorkingCopyUpdated` と同様の構造を維持する。
- ステップ間の UI 状態は React state や URL クエリで管理する。WC に `selectedCountries` など UI 固有要素を追加してはいけない。
- ダイアログで WC を表示する際は `draft` プロパティを展開してコンポーネントに渡す。

## 禁止事項
- `wizard` 系の状態やチェックボックスの一時値を WC に保存すること。
- `modifiedFields` などの差分トラッキング情報を WC に追加すること。
- `schemaVersion` / `isDraft` / `workingCopyId` といった冗長なフィールドを追加すること。

## DoD チェックリスト
- [ ] プラグインごとの `WorkingCopy` 型が `WorkingCopyDraft<TEntity>` で定義されている。
- [ ] Worker Handler が `createDraftWorkingCopyBase` と `markWorkingCopyUpdated` を利用している。
- [ ] UI コンポーネントが WC の `draft` を前提に実装され、UI 固有状態は別管理になっている。
- [ ] `pnpm --filter @hierarchidb/plugins-*-plugin typecheck` と関連ユニットテストがグリーン。
- [ ] `docs/plugins/working-copy-initial-payloads.md` の内容と実装が一致している。

## 関連ドキュメント
- `docs/plugins/working-copy-initial-payloads.md`: プラグインごとの初期値例。
- `packages/plugins/base-plugin`: 共通ヘルパーと型定義。
- `packages/plugins/*-plugin`: 各プラグイン実装。順次このガイドに沿ってリファクタリングすること。
