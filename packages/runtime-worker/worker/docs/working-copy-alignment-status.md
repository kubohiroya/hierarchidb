vk:doc kind=analysis audience=dev scope=worker

# WorkingCopy 実装と仕様のアライン状況（現状整理）

目的
- 現行実装（実装先行）を正しく仕様に反映し、達成点と未達/課題を明確化する。
- 後続の仕様アップデートおよび実装統合（片側へ寄せる）の足場を作る。

対象範囲
- Worker レイヤの WorkingCopy 周辺（EphemeralDB バックのサービス実装、および TreeNode ベースの WC 操作ユーティリティ）。
- 関連ファイル:
  - `src/services/WorkingCopyService.ts`
  - `src/services/EphemeralDB.ts`
  - `src/services/WorkingCopyTreeNodeOperations.ts`
  - `src/index.ts`（`WorkingCopyAPI` の公開）

---

## 現行実装（要約）

1) EphemeralDB バックのサービス実装（軽量 API）
- ファイル: `src/services/WorkingCopyService.ts`
- ストレージ: `EphemeralDB.workingCopies`（Dexie テーブル）
- 主な API:
  - `createDraftWorkingCopy(nodeType, parentId, initialData?)`: Ephemeral にドラフトを生成
  - `createWorkingCopyFromNode(nodeId)`: 既存ノードを Ephemeral に複製
  - `get/update/has/list/validate/hasUnsavedChanges`
  - `commitWorkingCopy(nodeId)`: 現状は Ephemeral 側を discard するだけ（Core 反映なし）
  - `commitMultipleWorkingCopies` / `createMultipleWorkingCopies` / `getWorkingCopyStats` / `cleanupOldWorkingCopies`
- 公開: `src/index.ts` 経由で `WorkingCopyAPI` を WorkerAPI として公開済み

2) TreeNode ベースの WC ユーティリティ（CoreDB 直操作）
- ファイル: `src/services/WorkingCopyTreeNodeOperations.ts`
- モデリング: CoreDB 上に WC 用の「ホルダー」Node と中身の Node をペアで作成
  - `createNewDraftWorkingCopy(treeId, parentId, nodeType, baseName)`
  - `createWorkingCopyFromNode(treeId, nodeId)`
  - `commitWorkingCopy(workingCopyNodeId, isDraft, onNameConflict)`
    - 名前重複時の `auto-rename`、楽観ロック（version 比較）に対応
  - `discardWorkingCopy([holderId, workingCopyId])` / `getWorkingCopy(originalNodeId)` / `updateWorkingCopy()` / `checkWorkingCopyConflict()`

観測事項
- 同一ドメインに「EphemeralDB ベースのサービス」/「CoreDB TreeNode ベースのユーティリティ」が併存。
- 前者は API 表面の最小実装、後者はコア操作の具体化（競合/リネーム含む）。

---

## 仕様との差分（推定）

達成していること（仕様化に取り込みたい）
- EphemeralDB による軽量な WC 作成/編集/一覧/統計・クリーンアップ（`WorkingCopyService`）。
- CoreDB 直の WC コミット手順（名前重複の自動リネーム、楽観ロック検出）と破棄ロジック（`WorkingCopyTreeNodeOperations`）。
- WorkerAPI から `WorkingCopyAPI` を取得できる導線（`index.ts`）。

未達/課題（仕様と実装の乖離）
- `commitWorkingCopy`（サービス実装）は CoreDB への反映をしておらず、破棄で代替している。
- 2 系統の実装が併存し、永続先（Ephemeral vs Core）・データモデルが異なる。
- 競合検出・自動リネーム等のロジックがサービス実装側に未移植。
- 監査/Undo/Redo/CommandProcessor との接続が未定義。
- 型の明確化不足（WC レコードの構造・必須/任意項目・ブランド型扱い）。

---

## アラインの方針（提案）

段階 1: 現行の挙動を仕様に反映（ドキュメントのみ）
- `WorkingCopyService` の挙動を仕様に記述（Ephemeral 前提、commit は破棄ベース）。
- `WorkingCopyTreeNodeOperations` のルール（楽観ロック/リネーム/ホルダー構造）を仕様に記述し「将来の永続仕様」として位置づけ。

段階 2: 実装統合の設計（コード未変更で計画のみ）
- サービス実装に「CoreDB 反映コミット」を移植する設計案を策定（データモデルも一本化）。
- 競合/自動リネーム/削除ペア管理の責務を定義（サービス層 or ユーティリティ層）。

段階 3: CP/監査/Undo連携の計画（コード未変更）
- `commitWorkingCopy` を CommandProcessor 経由とし、イベント記録・Undo を導入する計画をドラフト。

---

## チェックリスト（実装が達成していること）
- [x] EphemeralDB での WC 作成/更新/取得/一覧/削除 API
- [x] 複数一括（作成/コミット）と統計/クリーンアップの補助 API
- [x] CoreDB 直のコミット手順（競合検出/自動リネーム/破棄）ユーティリティ
- [x] WorkerAPI から WorkingCopyAPI へのアクセス公開

## チェックリスト（未達/課題）
- [ ] サービス実装の `commitWorkingCopy` が Core 反映していない（破棄で代用）
- [ ] データモデルの二重化（Ephemeral Row vs Core Node + Holder ペア）
- [ ] 競合検出/自動リネームのサービス層移植方針
- [ ] CommandProcessor/監査/Undo 連携の有無
- [ ] 型の明確化（WC レコード必須項目、`workingCopyOf` 等の扱い）

---

## 受け入れ基準（このドキュメント段階）
- 現行の実装挙動が仕様として文章化されている。
- 達成/未達がチェックリストで可視化されている。
- 統合の段階計画（ドキュメントのみ）が提示されている。

---

## 依存/関連
- `docs/command-processor-refactor-plan.md`
- `docs/task-comlink-typing-hardening.md`
- `docs/zod-envelope-introduction-plan.md`
 - `docs/working-copy-holder-encoding.md`
 - `docs/working-copy-ops-pseudocode.md`

---

## 単一WC共有の方針（確定）

- 前提: 原本（ノード/エンティティ）1つにつき、常にワーキングコピー（WC）は高々1つ。
- 共有: ブラウザ画面（タブ/ウィンドウ）が複数あっても、同一の唯一WCを共有して編集する。
- 冪等: `createWorkingCopy(...)` は冪等で、既存WCがあればそれを返す（`returnedExisting: true` 相当のメタで識別可能）。
- ロック: 編集ロックは導入しない（複数画面の同時編集を妨げない）。
- 競合制御: 上書き防止はコミット時の楽観ロック（`version` 比較）で行う。差異があれば `COMMIT_CONFLICT`。
- UI指針: liveQuery 等で原本の `version` 変化を検知し、「下書きのベースが古い」通知を表示。ユーザにリベース or そのままコミット試行（競合時は解消導線）を提示。

---

## 操作制約（移動/削除の既定）

- ポリシーC（既定）: 対象ノード自身または子孫にワーキングコピー（WC）が存在する間、そのノードの移動・削除はエラー（UIでは操作を無効/警告表示）。
- 目的: 未コミットの編集やドラフトがぶら下がる状態での構造変更を防止し、整合性とユーザ体験を守る。
- 判定の最小要件:
  - 編集WC: holder.name の第2要素（`targetNodeId`）が当該サブツリー内のノードIDに含まれる。
  - ドラフトWC: holder.name の第1要素（`targetParentNodeId`）が当該サブツリー内のノードIDに含まれる。
- 実装メモ:
  - 初期実装は `parentId` インデックスを用いたBFSでサブツリー集合を得て、WC holder を走査して判定（十分小規模で現実的）。
  - 最適化案として、`wcInSubtreeCount` のようなカウンタを各ノードに保持し、WC作成/破棄/コミット時に祖先へ累積更新することで O(1) 判定を可能にする（将来拡張）。
- UI補助: 右クリック/メニューに「このノード配下のワーキングコピー編集を順次再開」を用意し、ブロックされた操作の解消を支援する。
