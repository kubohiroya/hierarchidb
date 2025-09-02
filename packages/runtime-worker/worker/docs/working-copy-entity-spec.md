vk:doc kind=spec audience=dev scope=worker,node-type

# WorkingCopy（Entity 編）仕様（ドラフト）

目的
- TreeNode の WorkingCopy と連動する PeerEntity / GroupEntity の WorkingCopy を、同一テーブル内の別オブジェクトとして表現し、Core 単一 DB 内で整合的なトランザクションを可能にする。

前提
- 各 `treeId` ごとに `root/trash/workingCopy` の3根構成（TreeNode 側の新仕様）。
- TreeNode の WorkingCopy は holder+child のペアで表現され、child の NodeId（= WC ノードの ID）がユニークに存在する。

基本方針
- 各 Entity（Peer/Group/Relational 等）のテーブルは、Canonical データと WorkingCopy データを「同一テーブル内で共存」させる。
- WorkingCopy の行は、TreeNode の WorkingCopy child の NodeId を `workingCopyId` として持つ（= Tree 側 WC と 1:1 対応）。
- Canonical 行とは `workingCopyOf` フィールドで関係付ける（編集 WC は `workingCopyOf = originalEntityId`、ドラフト WC は `null`）。

フィールド定義（追加/予約）
- `id: EntityId`（PK）: Canonical/WorkingCopy 共通。WC の場合は `id = workingCopyId` を採用する（別 ID 空間）。
- `workingCopyId?: NodeId`（WC のみ）: TreeNode WC child の NodeId。
- `workingCopyOf?: EntityId | null`（編集 WC のみ）: 対象の Canonical EntityId。ドラフトは `null`。
- `isWorkingCopy?: boolean`（任意）: クエリ簡略化用の補助フラグ（導出可だが利便性のため保持可）。
- `version: number`（必須）: 楽観ロック。WC はスナップショット時の `version` を保持。Commit 時に比較し、競合を検出。
- 既存の Entity フィールドは不変（JSON シリアライズ可能な構造に限定）。

インデックス（Dexie 例）
- `&id, workingCopyId, workingCopyOf, [workingCopyOf+id], isWorkingCopy`
- 典型的なクエリ
  - Canonical のみ: `where('isWorkingCopy').equals(false)` or `where('workingCopyOf').equals(null)`
  - WC 一括取得: `where('workingCopyId').anyOf([...wcNodeIds])`
  - ある原本の WC: `where('workingCopyOf').equals(originalEntityId)`

ライフサイクル
1) 作成（Tree 側 WC 作成時のフック）
   - メタデータ（node-type 設定）で対象となる Entity テーブルを列挙。
   - 各テーブルに 1 行ずつ WC を作成する。
   - PK は `id = workingCopyId`（= Tree の WC child NodeId）。`workingCopyOf` は編集時のみ設定。

2) 更新
   - WC 行は自由に編集可能（構造化クローン可能な値に限定）。
   - `updatedAt/version` の更新規約は Entity ごとに統一（`version++` は commit 側で実施）。

3) コミット
   - 編集 WC: `workingCopyOf` で指す原本をロードし、`version` を比較。
     - `original.version > wc.version` なら `COMMIT_CONFLICT`。
     - それ以外は原本へフィールド上書き（フィールド単位のマージポリシーは型仕様で定義）。
   - ドラフト WC: 原本行は存在しないため、新しい `id` で Canonical 行を作成（TreeNode 側の commit で採番した `targetNodeId` と整合するようにする）。
   - 成功時は、対応する WC 行を削除する（Tree 側の holder/child ペア削除と同一トランザクションを推奨）。

4) 破棄
   - WC 行を削除。Tree 側の holder/child も併せて削除（同一トランザクションが望ましい）。

5) GC/整合性
   - Tree 側 WC が存在しない `workingCopyId` の行は孤児として削除対象。
   - `workingCopyOf` が存在しない編集 WC は不整合として警告（作成/削除のレースを監視）。

トランザクション境界
- 可能な限り TreeNode（nodes）と各 Entity テーブルの更新は同一 Dexie トランザクションで行う。
- 失敗時はロールバックされ、WC 行／Tree の WC ペアに不整合が出ないこと。

クエリ/ビューのガイドライン
- 既存の「Canonical データだけが欲しい」クエリは、`isWorkingCopy=false`（もしくは `workingCopyOf = null`）を必ず条件に含める。
- Node タイプの UI は、WC が存在する場合に編集用データを優先的に表示するか（プレビュー）、Canonical を表示するかを明示的に切替える。

イベント/監査
- `createWC / updateWC / commitWC / discardWC` のイベントを CommandProcessor もしくはイベントバスに記録（詳細は CP リファクタに追従）。
- ログはサニタイズされ、機密フィールドはマスクする。

エッジケース
- 原本が commit 前に移動/削除/Trash 移動された場合の扱い（要件に応じ選択）
  - A: エラーにして WC を残し、ユーザに解決を促す
  - B: 現在の原本位置/状態に合わせて best-effort でマージ
- 複数の WC が同一原本を指す同時編集は、`version` 競合で解決（後勝ち/マージ UI は将来拡張）。

受け入れ基準（仕様段階）
- 同一テーブル内に Canonical と WC が共存するデータモデルが明確。
- `workingCopyId` と Tree 側 WC child の NodeId が 1:1 対応であること。
- トランザクション/競合/破棄の流れが文章化されていること。

関連
- Tree 側 WC 仕様（holder+child, 3根）
- `docs/working-copy-alignment-status.md`
- `docs/command-processor-refactor-plan.md`
- `docs/task-comlink-typing-hardening.md`

---

## 単一WC共有と競合ポリシー（補足）

- 単一性: 原本1つにつき WC は常に1つ（グローバル共有）。複数画面から同一WCを編集できる。
- 冪等性: `createWorkingCopy(...)` は既存WCを再利用して返す（既存返却メタを付与可能）。
- 一意制約（推奨）:
  - Entity 側: `workingCopyId` はユニーク。編集 WC の `workingCopyOf` は1:1（アプリ側保証でも可）。
  - Tree 側: holder は `[parentId+name]`（`name = ${targetParentId}\t${targetNodeId}`）で一意。child は1つのみ。
- 競合制御: コミット時のみ楽観ロック（`version` 比較）を適用。差異があれば `COMMIT_CONFLICT` を返し、UIで解消導線を提示。
- UIガイドライン:
  - 原本 `version` 変化を検知し「下書きのベースが古い」バナー表示。
  - ユーザ選択肢: リベース or そのままコミット試行（競合時に明示）。
