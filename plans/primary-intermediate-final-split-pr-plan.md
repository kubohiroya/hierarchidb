# Primary / Intermediate / Final 抽象化移行: 分割PR実行計画

## 目的
- 既存の `Source / Geometry / TileEmit` 命名を、抽象契約として `Primary / Intermediate / Final` へ移行する。
- ドメイン実装（shape/route/location 等）は抽象契約にぶら下げ、段数・処理内容の差分は「構成データ」で吸収する。
- feature flag は導入しない。interface-first で置換する。

## 非目標
- 互換フォールバック（旧名を受け続ける分岐）の恒久運用。
- 3-stage 固定前提の UI 実装温存。
- DB マイグレーション互換層（今回は既存データ破棄許容の前提）。

## 設計原則
1. 先に契約を固定し、実装は契約へ適合させる。
2. 命名変換ロジックを各所に散らさず、単一モジュールに集約する。
3. `Intermediate` は 1..N 段で構成可能にする。
4. UI/Worker は固定ステージ名で分岐せず、セッション構成を参照して動作する。
5. 旧語彙は段階的に削除し、最終PRで禁止ルールを有効化する。

## 先行で固定する契約（SSOT）
- `StageRole = 'primary' | 'intermediate' | 'final'`
- `BuildSessionStageDescriptor`
  - `id: string`（例: `primary-0`, `intermediate-0`, `intermediate-1`, `final-0`）
  - `role: StageRole`
  - `capability: string`（例: `source-fetch`, `geometry-simplify`, `tile-emit`）
  - `order: number`
  - `retryPolicy`, `guard`, `ioContractRef`
- `BuildSessionScenario`
  - `scenarioId`, `stageDescriptors[]`, `uiHints`, `taskDisplayPolicy`

## 分割PR計画

### PR-1: 契約導入（型・用語・変換境界）
- 追加:
  - `StageRole` / `BuildSessionStageDescriptor` / `BuildSessionScenario` 型
  - `stageRoleMapper`（既存 `source/geometry/tileEmit` -> `primary/intermediate/final`）
- 変更:
  - 既存 stage alias 実装を「契約モジュール経由」に統一
- DoD:
  - 既存機能の挙動不変
  - 旧語彙への直接依存が新規に増えない

### PR-2: Worker実行系を descriptor 駆動化
- 変更:
  - Worker の実行順を固定 if/else から `stageDescriptors` 反復へ変更
  - `Intermediate` の複数段対応（1..N）
- DoD:
  - shape 現行シナリオを descriptor 化して同等動作
  - pause/resume/retry が段数増でも破綻しない

### PR-3: TaskQueue/Progress の role 化
- 変更:
  - task metadata に `stageRole` と `stageId` を常時付与
  - progress 集計を role + stageId ベースへ変更
- DoD:
  - 集計キーが固定3語彙に依存しない
  - 既存テストが role ベースでも通る

### PR-4: UI表示を role/descriptor 参照へ移行
- 変更:
  - ステージ表示名・色・順序を `uiHints` から解決
  - `Intermediate` 複数段を動的表示
- DoD:
  - shape 現行構成（実質3段）が従来同等表示
  - 中間段を2段以上にしたシナリオで表示崩れがない

### PR-5: shape シナリオを Primary/Intermediate/Final へ正式移行
- 変更:
  - shape の session composition を role ベースへ置換
  - `Source/Geometry/TileEmit` は capability ラベルへ退避
- DoD:
  - shape build の開始・再開・失敗・再試行の主要ケースが通る
  - 旧ステージ語彙への直接参照ゼロ（shape範囲）

### PR-6: route/location への展開
- 変更:
  - route/location を同契約へ揃える
  - シナリオ差分を descriptor で管理
- DoD:
  - 各プラグインで単一実行エンジンを共有
  - プラグイン固有差分は capability 実装のみ

### PR-7: 旧語彙削除と静的ガード
- 変更:
  - 旧 alias / 旧 stage key / 旧 UIキーを削除
  - lint/grep gate で `fetch|transform|vt`（ステージ文脈）を禁止
- DoD:
  - 旧語彙のステージ文脈ヒット 0
  - CI で再発防止

## 検証マトリクス（全PR共通）
1. 正常系: primary -> intermediate(n) -> final 完走
2. 中断再開: intermediate 完了後の resume
3. 部分失敗: intermediate の一部失敗時の session 終端規則
4. retry: retriable/non-retriable の境界
5. UI同期: task snapshot 遅延時の表示整合
6. キャッシュ再利用: 同一入力で primary 再計算抑止

## リスクと回避
- リスク: 命名変更と責務変更を同時に行い、差分が肥大化
  - 回避: PR-1/2 は「契約導入のみ」「実行器置換のみ」に分離
- リスク: UIが旧固定3段依存で崩れる
  - 回避: PR-4で descriptor 駆動化を先に完了
- リスク: alias 残骸で暗黙互換が残る
  - 回避: PR-7で削除 + lint gate

## 直近着手タスク（この計画の開始点）
1. PR-1 用に契約型ファイルを追加（runtime-worker / build-api 境界）
2. stage alias 実装を契約モジュール経由へ寄せる
3. shape の最小シナリオ descriptor（3段相当）を fixtures として追加
4. 単体テスト: role mapper / descriptor validator / alias 変換

## 進捗
- 2026-03-01: 分割PR計画の初版を作成（本ファイル）。
