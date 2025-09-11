# PLA: デフォルトON化に向けた推奨着手順（依存関係ベース）

日付: 2025-09-10
対象フラグ: `WORKER_ENTITY_UNIFIED`, `WORKER_WC_COMMIT_V2`, `WORKER_TRASH_USE_HOLDER`, `WORKER_POLICY_C`, `WORKER_TX_ENABLED`

## 結論（並列化を含む推奨順）
1-A) WORKER_ENTITY_UNIFIED（限定タイプでCanary ON）
1-B) WC系UI整備（WC_COMMIT_V2/Policy C のダイアログ・再試行導線）
1-C) TRASH_USE_HOLDER 移行スクリプト実装（Dry-run対応まで）

2-A) WORKER_WC_COMMIT_V2（UI準備完了後にCanary ON）
2-B) TRASH_USE_HOLDER 移行Dry-runをStaging全データで実施（まだONにしない）
2-C) WORKER_ENTITY_UNIFIED の対象タイプ拡大（主要タイプへ）
2-D) WORKER_TX_ENABLED のテーブル集合棚卸し/テスト追加（フラグはOFFのまま）

3-A) WORKER_TRASH_USE_HOLDER（移行レポートがクリーンならCanary ON）
3-B) WORKER_POLICY_C（UIが整っていれば並列Canary ON可）
3-C) ENTITY_UNIFIED メトリクス最適化（bulk経路/スロットリング調整）

4-A) WORKER_TX_ENABLED Canary ON（影響大のため単独で）
4-B) TX下での性能/ロールバックE2Eの追込み（必要に応じてテーブル集合の見直し）

5-A) 全面ON（100%）+ 監視ルール固化
5-B) レガシー経路のドキュメント整理/縮退（必要なら完全削除は別イテレーション）

### 並列実施の考え方（要旨）
- 1-A/1-B/1-C は Worker/UI/移行ツールで相互依存が薄く、同時進行が安全。
- 2-A は UI準備完了が前提。2-B/2-C/2-D は 2-A と独立に進められるため並列化。
- 3-A と 3-B は前提（UI整備・Staging移行クリーン）が満たされれば同一デプロイ波で Canary 可能。
- 4-A は影響が大きく単独で評価すべき。4-B はその観測に基づく調整。

#### 補足: フェーズ1の並列性（1-A/1-B/1-C）
- 結論: 1-A, 1-B, 1-C は並列着手可能です。
- 境界安定化: 1-A（ENTITY_UNIFIED）は Best‑effort 通知でAPI/イベント語彙を変更しない。UI破壊を避ける。
- 環境分離: 1-C（Trash移行スクリプト）は Staging 複製データで Dry‑run のみ。本番DBは触れない。
- 合流ゲート: フェーズ2へ進む前に、以下をレビューで合意する。
  - 1-A Canary 健全性（エラーレート/レイテンシ退行なし）
  - 1-B E2E（競合/名称衝突/Policy C ブロックのUX）
  - 1-C Dry‑run レポート（要人手対応件数と対処方針）

## 依存関係分析（要点）
- 非破壊性/逆転容易性
  - ENTITY_UNIFIED は Best-effort 通知でメインフローに影響を与えにくく、失敗しても操作は継続（例外を飲み込む設計）。段階導入に最適。
  - TX_ENABLED は最も巻き戻しやすいが、ONにすると経路全体の挙動が一変し、失敗時の切り分けが難しくなるため最後。
- UI 依存度
  - WC_COMMIT_V2 と POLICY_C は UI 側のガイダンス/再試行導線が必要。UI 実装の完了を前提に順序を後ろへ。
  - TRASH_USE_HOLDER は UI 影響が比較的小さく（一覧/復元の内部構造差）、移行が済めば安定。WC系UIとの直交性が高い。
- データモデル/移行
  - TRASH_USE_HOLDER は移行タスクが伴うため、先に V2 commit の安定化（＝WC関連のUX整備）を完了してからの方が同時作業のリスクが下がる。
- 相乗効果
  - ENTITY_UNIFIED を先にONすると、以後の duplicate/import/paste/commit がピア/グループ/リレーションを自動同期でき、リグレッション検知が早まる。

## 詳細ステップと理由

### フェーズ1: WORKER_ENTITY_UNIFIED（限定ON）
- 理由
  - 例外は握りつぶし（Best-effort）でメインフロー非停止。
  - 以降のフローでストア連携の不備やIDマッピング漏れを早期に露呈できる。
- 対象ディレクトリ
  - `packages/runtime-worker/worker/src/entity/**`
  - `packages/runtime-worker/worker/src/services/**`（通知ポイント）
  - `packages/node-type/*-plugin/`（該当タイプのストア確認）
- ゲート
  - 主要ノードタイプでの duplicate/import/paste/commit における peer/group/relation 同期のE2Eがグリーン。

### フェーズ2: WORKER_WC_COMMIT_V2
- 理由
  - 競合/名称衝突の厳密化を既定化。UI 側実装と相性が強く、ENTITY_UNIFIED がONだとピア同期も同時に検証可能。
- 対象ディレクトリ
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
  - `packages/runtime-worker/worker/src/services/WorkingCopyService.ts`
  - `packages/runtime-worker/worker/src/services/WorkingCopyTreeNodeOperations.ts`
  - `app/**`, `packages/runtime-ui/**`（競合ダイアログ/再試行）
- ゲート
  - COMMIT_CONFLICT/NAME_CONFLICT のUIハンドリング（再試行/自動リネーム）が実装済み。
  - 併走コミットE2Eで安定的に競合検出・解消できる。

### フェーズ3: WORKER_TRASH_USE_HOLDER
- 理由
  - データモデルの統一（ホルダー方式）。移行実施後は復元の確実性が上がる。WC/Commitの導線整備後に移行を行う方が運用負荷が小さい。
- 対象ディレクトリ
  - `packages/runtime-worker/worker/src/services/TreeMutationService.ts`
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
  - `packages/runtime-worker/worker/src/services/utils/holder-encoding.ts`
  - `scripts/**`（移行スクリプト）
- ゲート
  - Dry-run レポートで欠落/不整合が0件 or 許容内。
  - 旧データ混在環境での往復動作（移動→復元→再移動）がE2Eでグリーン。

### フェーズ4: WORKER_POLICY_C
- 理由
  - サブツリーにWCがあると操作をブロック。UIの案内/解消導線が整ってからONが安全。
  - TRASH/WC の基盤が固まっている状態で導入することで誤検出/偽陰性の調整が容易。
- 対象ディレクトリ
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
  - `packages/runtime-worker/worker/src/services/utils/policy-c.ts`
  - `app/**`, `packages/runtime-ui/**`（ブロック時ガイダンス/一括コミット・破棄）
- ゲート
  - 大規模ツリーの検出P95がベースライン比+5%以内。
  - 偽陽性/偽陰性の再現テストがグリーン。

### フェーズ5: WORKER_TX_ENABLED
- 理由
  - ONにすると失敗時の現象が「どこで起きたか」を見通しづらく、前段フェーズの安定化後に適用するのが最小リスク。
  - コマンドごとのテーブル集合（`nodes/trees/rootStates/tags/tagAssociations`）の網羅が前提。
- 対象ディレクトリ
  - `packages/runtime-worker/worker/src/services/CommandProcessor.ts`
  - `packages/runtime-worker/worker/src/services/CoreDB.ts`
- ゲート
  - 例外注入E2Eでの完全ロールバックが全コマンドで成立。
  - 大量操作でのP95/エラーレート退行なし。

## ロールバック指針（段階）
- 直近ONのフラグから順にOFFへ（TX→PolicyC→Trash→WC-V2→Entity）。
- Canary 10%→50%→100%の段階適用・解除を基本運用とする。

## 参考（作業計画ファイル）
- PLAN-2025-09-10-worker-entity-unified-default-on.md
- PLAN-2025-09-10-worker-wc-commit-v2-default-on.md
- PLAN-2025-09-10-worker-trash-use-holder-default-on.md
- PLAN-2025-09-10-worker-policy-c-default-on.md
- PLAN-2025-09-10-worker-tx-enabled-default-on.md
