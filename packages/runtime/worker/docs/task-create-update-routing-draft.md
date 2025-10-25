vk:task id=phased-routing-create-update-draft status=planning priority=P1 labels=worker,mutation,undo

# タスク: create/update の段階ルーティング（設計ドラフト）

## 背景 / 目的
- 実装前に、最小経路切替と監査・Undo/Redo への影響を合意する。

## 非目的（このタスクではやらない）
- コード実装・フラグ追加・既存経路の変更。
- move/remove/duplicate/paste/import/restore の経路切替。

## 成果物
- 小さなPRに分解可能なチェックリスト。
- 受け入れ基準（ON/OFF 両系統の期待挙動）。

## チェックリスト（スモールステップ）
- [ ] フラグ設計の決定（命名・配置・既定値）。
- [ ] Envelope 仕様の確認（kind/type/meta の最小必須項目）。
- [ ] createNode の最小ハンドラ仕様（DB 書込/戻り値）。
- [ ] updateNode の最小ハンドラ仕様（ロード→パッチ→更新）。
- [ ] Undo/Redo の適用範囲（create のみ対象・update は後続）。
- [ ] ログ/イベントのサニタイズ方針（漏洩防止）。
- [ ] テスト観点（ON/OFF, 正常/異常, 監査）。

## 受け入れ基準（このドラフトの段階）
- 実装手順が 3–5 個の小粒 PR に分割できる。
- 既定 OFF（非回帰）であることが明記されている。
- ロールバックがフラグ OFF で即時に可能である。

## メモ
- CommandProcessor の実装詳細は次タスクで扱う。ここでは「何をいつ変えるか」を合意する。

---

## フラグ設計（案）
- 名称: `WORKER_USE_CMDPROC_CREATE_UPDATE`
- 種別: 環境変数（`scripts/env_vite.sh` から注入）
- 値: `"0" | "1"`（既定は `"0"`）
- 影響範囲: `TreeMutationService.createNode` / `updateNode` のみ。その他は非対象。
- 実装方針（後続PRで実施）:
  - 読み取りは 1 箇所に集約（※2025-10-25 時点で `FEATURE_FLAGS` は撤廃済み。環境変数ベースの切り替えが必要な場合は新しいコンフィグモジュールを導入すること）。
  - 既定 OFF を明示し、無指定時は OFF。
- 危険な動的トグルは不可。プロセス起動時に固定。

参照: `docs/feature-flags.md`

## Envelope 最小仕様（案）
参考: `docs/zod-envelope-introduction-plan.md`

共通フィールド
- `kind`: `"createNode" | "updateNode"`
- `commandId`: string（UUID 形式を推奨）
- `issuedAt`: number（Timestamp）
- `meta`: `{ userId?: string; correlationId?: string }`（任意）

成功レスポンス
- 共通: `{ success: true; seq: number }`
- createNode: 追加で `{ nodeId: NodeId }` を返却

失敗レスポンス
- `{ success: false; error: string; code: ErrorCode; seq?: number }`

payload（createNode）
- `nodeId: NodeId`（呼び出し側で生成。将来、CP 側生成へ移行可）
- `treeId: TreeId`
- `parentId: NodeId`
- `nodeType: NodeType`
- `name: string`
- `description?: string`

payload（updateNode）
- `nodeId: NodeId`
- `name?: string`
- `description?: string`

備考
- `type` は後方互換のエイリアスとして保持可能だが、`kind` を主とする。
- 監査ログはサニタイズされたイベントとして保存（error の詳細は伏せ字）

## 小粒 PR 分割案
PR-1: フラグ受け皿のみ（実行経路無変更）
- `config/feature-flags.md`（legacy ドキュメント）と `scripts/env_vite.sh` の利用例更新
- ランタイムコードにはインポート可能な定数を追加（未使用警告を避けるためコメントで抑止）

PR-2: Envelope 型の最小整備（実行経路無変更）
- `CommandEnvelope` 周辺の最小型チェックとドキュメントリンク
- `expectTypeOf` 等の型テスト（落ちない範囲で）

PR-3: create/update の経路分岐の雛形（実装ガードのみ／無効化）
- 分岐コードは配置するが、フラグ既定 OFF で無効化（実行されない）
- E2E/ユニットは完全非回帰を確認

PR-4: createNode の最小ハンドラと ON 時の動作検証
- 監査イベントの記録、Undo スタック積載（create のみ）
- ON/OFF の動作差をユニットで検証

PR-5: updateNode のハンドラ導入（Undo は後続）
- 既存直書き込みとの等価性（フィールド差分）を確認

ロールバック
- いずれの PR も、フラグ OFF で即時ロールバック可能。

---

## 次アクション（ここで一旦停止）
- [ ] PR-1（ドキュメントのみ）: `docs/feature-flags.md` をベースに、モノレポ横断の記載整備と `env_vite.sh` 追補の草案作成。
- 本ドラフトはここで区切り。合意後、PR-1 から着手。

## テスト計画（ON/OFF 双方）
- 単体（Vitest）
  - createNode: 成功時に `nodeId` が返る（ON/OFF）
  - updateNode: name/description の更新が反映される（ON/OFF）
  - ON: `CommandProcessor` がイベントを1件記録し、Undo スタックが増加（create のみ）
- 統合（既存 E2E の範囲で差分確認）
  - 起動フラグ差で基本操作（作成/更新）が非回帰

## リスクと緩和策
- リスク: 経路差による、副作用/時刻/version 増分の差
  - 緩和: ON/OFF の両系統で差分検証。version/updatedAt の規約をドキュメント化。
- リスク: 監査ログに機密情報が混入
  - 緩和: サニタイズポリシー（error 詳細は伏せ字、payload の一部マスク）を先に定義

## 依存/関連
- `docs/task-phased-routing-to-commandprocessor.md`
- `docs/zod-envelope-introduction-plan.md`
- `docs/command-processor-refactor-plan.md`

---

## 依存関係（進行中ブランチの前提）
- CommandProcessor リファクタ計画（別ブランチ）: `docs/command-processor-refactor-plan.md`
  - 影響: kind/type の整理、エラーモデル統一、seq/イベント履歴の責務が変更される可能性。
- Comlink 型強化（別ブランチ）: `docs/task-comlink-typing-hardening.md`
  - 影響: Envelope/Result に構造化クローン可能な型制約を完全適用。Proxy/境界の設計整理。

## ブロッキング項目（合流待ちで決める）
- kind/type の一本化と互換方針（`type` エイリアスの存続可否）
- エラーモデル（コード体系/文言/ログサニタイズ粒度）の最終仕様
- seq 採番とイベント記録の責務（CP 側に集約するか）
- 実行先の最終方針（CommandProcessor 直委譲 vs コマンドレジストリ経由）
- Comlink 境界でのブランド型表現と返却値のシリアライズ方針
