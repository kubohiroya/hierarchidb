# 実装計画: 大規模ファイル分割 (Large File Decomposition)

## 概要

既存 Audit Tool（`scripts/naming-audit/`）の基盤を再利用し、`scripts/decomposition/` に 7 モジュール + CLI エントリポイントを段階的に構築する。検出 → 解析 → 計画生成 → 検証 の4段階パイプラインを、各モジュール単位で実装・テストしながら結合していく。

## タスク

- [x] 1. 型定義とプロジェクト構造のセットアップ
  - [x] 1.1 `scripts/decomposition/types.ts` を作成し、全データモデル型を定義する
    - `ThresholdResult`, `SymbolNode`, `DependencyGraph`, `FileStructure`, `CohesionGroup`, `GroupRole`, `CycleWarning`, `SplitTarget`, `SplitPlan`, `SplitPattern`, `ImportUpdate`, `NamingViolation`, `CircularImportWarning`, `ApiPreservationResult`, `ValidationResult`, `SplitPlanOptions`, `NamingGuidelineConfig`, `AnalysisReport`, `ProgressState`
    - 既存型（`FileEntry`, `FileAnalysis`, `ExportInfo`, `ExportKind`, `ComponentMetrics`）は `scripts/naming-audit/types.ts` から import
    - _要件: 全要件の基盤_

- [x] 2. ThresholdFilter の実装
  - [x] 2.1 `scripts/decomposition/thresholdFilter.ts` を作成する
    - `filterByThreshold`: FileEntry 配列から行数 ≥ 閾値のファイルをフィルタ（テストファイル除外）
    - `computePriorityScore`: `lineCount × exportCount` の優先度スコア算出
    - 結果を行数降順でソート
    - 既存 `fileScanner.scanFiles()` の結果を入力として受け取る
    - _要件: 1.1, 1.2, 1.3, 9.1, 9.2_
  - [ ]* 2.2 Property 1 のプロパティテストを作成する
    - **Property 1: 閾値フィルタの正確性**
    - ランダム FileEntry 配列（行数 0〜2000、テスト/非テストパス混在）で検証
    - (a) 全結果の lineCount ≥ T、(b) テストファイル除外、(c) 条件を満たす全ファイルが含まれる
    - **検証対象: 要件 1.1, 1.2**
  - [ ]* 2.3 Property 2 のプロパティテストを作成する
    - **Property 2: 検出結果の行数降順ソート**
    - ランダム ThresholdResult 配列で隣接ペアの lineCount 降順を検証
    - **検証対象: 要件 1.3**
  - [ ]* 2.4 Property 18 のプロパティテストを作成する
    - **Property 18: 優先度スコアの算出と順序**
    - ランダム正整数ペアで `computePriorityScore(l, e) = l × e` を検証
    - **検証対象: 要件 9.1, 9.2**
  - [ ]* 2.5 Property 19 のプロパティテストを作成する
    - **Property 19: バッチ制限**
    - ランダム結果配列 + バッチサイズ n で出力件数 = min(n, total) を検証
    - **検証対象: 要件 9.3**

- [x] 3. StructureAnalyzer の実装
  - [x] 3.1 `scripts/decomposition/structureAnalyzer.ts` を作成する
    - `analyzeStructure`: ts-morph を使用してファイル内シンボル（関数・クラス・型・定数）を抽出
    - `buildDependencyGraph`: シンボル間のファイル内参照関係から DependencyGraph を構築
    - 既存 `exportAnalyzer` と `naming-audit/types` を再利用
    - _要件: 2.1, 2.2_
  - [ ]* 3.2 StructureAnalyzer のユニットテストを作成する
    - サンプル TypeScript ファイルに対するシンボル抽出・依存グラフ構築の検証
    - _要件: 2.1, 2.2_

- [x] 4. チェックポイント - テスト実行確認
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 5. CohesionGrouper の実装
  - [x] 5.1 `scripts/decomposition/cohesionGrouper.ts` を作成する
    - `groupByCohesion`: SCC アルゴリズムで依存グラフからシンボルを凝集グループに分類
    - `detectInterGroupCycles`: グループ間の循環参照を検出
    - 各グループに `GroupRole`（types, utils, hook, component 等）を推定付与
    - _要件: 2.3, 2.4_
  - [ ]* 5.2 Property 3 のプロパティテストを作成する
    - **Property 3: 凝集グループのパーティション性**
    - ランダム有向グラフ（ノード 1〜30、エッジ密度 0〜50%）で検証
    - (a) 全シンボルがちょうど1グループ、(b) 同一 SCC は同一グループ、(c) 和集合 = 全ノード
    - **検証対象: 要件 2.3**
  - [ ]* 5.3 Property 4 のプロパティテストを作成する
    - **Property 4: グループ間循環参照の検出**
    - グループ間エッジを含むランダムグラフで循環検出の完全性を検証
    - **検証対象: 要件 2.4**

- [x] 6. SplitPlanGenerator の実装
  - [x] 6.1 `scripts/decomposition/splitPlanGenerator.ts` を作成する
    - `generateSplitPlan`: 凝集グループと分割パターンに基づき SplitPlan を生成
    - `applyContainerPresentationalPattern`: .tsx の Container/Presentational 分離パターン適用
    - `applyTsDecompositionPattern`: .ts の分割パターン（hook, utility, multi-function）適用
    - 分割先ファイル名を Naming_Guideline に準拠して生成
    - _要件: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Property 5 のプロパティテストを作成する
    - **Property 5: 分割計画の命名規約準拠**
    - ランダム CohesionGroup（各種 role）で全 SplitTarget.targetPath の命名規約準拠を検証
    - **検証対象: 要件 3.1, 4.1**
  - [ ]* 6.3 Property 6 のプロパティテストを作成する
    - **Property 6: 分割後ファイルの閾値遵守**
    - ランダム FileStructure（行数 600〜2000）で全 SplitTarget.estimatedLineCount ≤ threshold を検証
    - **検証対象: 要件 3.2, 4.2**
  - [ ]* 6.4 Property 7 のプロパティテストを作成する
    - **Property 7: Container/Presentational パターンの適用**
    - ランダム ComponentMetrics（JSX 0〜200行、hooks 0〜10）で分離パターン適用条件を検証
    - **検証対象: 要件 3.4, 6.1**
  - [ ]* 6.5 Property 8 のプロパティテストを作成する
    - **Property 8: 分割計画の非循環性**
    - ランダム SplitPlan の import グラフが DAG であることを検証
    - **検証対象: 要件 3.5**
  - [ ]* 6.6 Property 9 のプロパティテストを作成する
    - **Property 9: シンボル抽出閾値**
    - ランダム SymbolNode 配列（type/function 混在）で型 ≥ 3 → types.ts 分離、純関数 ≥ 3 → utils.ts 分離を検証
    - **検証対象: 要件 3.6, 3.7**
  - [ ]* 6.7 Property 10 のプロパティテストを作成する
    - **Property 10: パブリック API の保全**
    - ランダム FileStructure + SplitPlan で元ファイルの全エクスポート = 全 SplitTarget シンボル和集合を検証
    - **検証対象: 要件 4.4, 7.1**
  - [ ]* 6.8 Property 11 のプロパティテストを作成する
    - **Property 11: 単一メイン関数 + ヘルパーパターン**
    - 1つの大規模エクスポート関数 + 複数ヘルパーの FileStructure でパターン適用を検証
    - **検証対象: 要件 5.1**
  - [ ]* 6.9 Property 12 のプロパティテストを作成する
    - **Property 12: 複数独立関数の分離パターン**
    - 相互依存なしの複数エクスポート関数で各 CohesionGroup → 個別 SplitTarget を検証
    - **検証対象: 要件 5.2**
  - [ ]* 6.10 Property 13 のプロパティテストを作成する
    - **Property 13: Hook 分割パターン**
    - Hook ファイル構造で AGENTS.md の Hook 4分類ルールに従った分割を検証
    - **検証対象: 要件 5.3**
  - [ ]* 6.11 Property 14 のプロパティテストを作成する
    - **Property 14: index.ts の再エクスポート専用制約**
    - SplitPlan に index.ts が含まれる場合、実ロジックシンボルを含まないことを検証
    - **検証対象: 要件 5.4**
  - [ ]* 6.12 Property 15 のプロパティテストを作成する
    - **Property 15: .tsx 複数コンポーネント・render ヘルパーの分離**
    - 複数コンポーネント / render* ヘルパーを含む .tsx で個別ファイル分離を検証
    - **検証対象: 要件 6.2, 6.3**

- [x] 7. チェックポイント - テスト実行確認
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 8. PlanValidator の実装
  - [x] 8.1 `scripts/decomposition/planValidator.ts` を作成する
    - `validatePlan`: 分割計画の総合検証（命名規約・行数・循環 import・API 保全）
    - `validateNaming`: 既存 ruleEngine を参照して分割先ファイル名の命名規約準拠を検証
    - `detectCircularImports`: 分割後のファイル間循環 import を検出
    - `verifyApiPreservation`: 元ファイルの全パブリック API が分割先で保全されることを検証
    - _要件: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.5, 8.1_
  - [ ]* 8.2 Property 16 のプロパティテストを作成する
    - **Property 16: import 更新の完全性**
    - ランダム外部 importer 配列で全ファイルが importUpdates に含まれることを検証
    - **検証対象: 要件 7.2**
  - [ ]* 8.3 Property 17 のプロパティテストを作成する
    - **Property 17: テストファイル import 更新**
    - テストファイルが存在する場合の import パス更新が importUpdates に含まれることを検証
    - **検証対象: 要件 7.5**

- [x] 9. Reporter の実装
  - [x] 9.1 `scripts/decomposition/reporter.ts` を作成する
    - `reportResults`: AnalysisReport を json / table 形式で stdout に出力
    - table 形式: ファイルパス・行数・エクスポート数・凝集グループ数・優先度スコアのカラム
    - json 形式: AnalysisReport 全体を JSON.stringify で出力
    - _要件: 1.4, 1.5_
  - [ ]* 9.2 Reporter のユニットテストを作成する
    - JSON / table 出力フォーマットの具体的な形式検証
    - _要件: 1.4, 1.5_

- [x] 10. ProgressTracker の実装
  - [x] 10.1 `scripts/decomposition/progressTracker.ts` を作成する
    - `loadProgress`: 追跡ファイルから ProgressState を読み込み（存在しない場合は初期状態）
    - `saveProgress`: ProgressState を追跡ファイルに保存
    - `markCompleted`: 分割済みファイルを記録し remainingCount を更新
    - _要件: 9.4_
  - [ ]* 10.2 Property 20 のプロパティテストを作成する
    - **Property 20: 進捗追跡のラウンドトリップ**
    - ランダム ProgressState で save → load のラウンドトリップ等価性、markCompleted k 回後の remainingCount = totalTargetFiles - k を検証
    - **検証対象: 要件 9.4**

- [x] 11. チェックポイント - テスト実行確認
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

- [x] 12. CLI エントリポイントと統合
  - [x] 12.1 `scripts/decomposition-analyzer.ts` を作成する
    - CLI 引数パース（`--format`, `--batch`, `--target`, `--validate-only`, `--threshold`）
    - パイプライン実行: FileScanner → ThresholdFilter → StructureAnalyzer → CohesionGrouper → SplitPlanGenerator → PlanValidator → Reporter
    - 終了コード体系: 0=正常、1=検証違反あり、2=CLI 引数エラー
    - ProgressTracker との統合
    - Audit Tool の ruleEngine との統合（要件 8.1, 8.2, 8.3）
    - _要件: 1.4, 1.5, 4.3, 8.1, 8.2, 8.3, 9.3_
  - [ ]* 12.2 CLI のユニットテストを作成する
    - CLI 引数パース（正常系・異常系）
    - 終了コード体系（0, 1, 2）の検証
    - `--batch` に非正整数、`--format` に不正値のエラーハンドリング
    - _要件: 8.3_

- [x] 13. 最終チェックポイント - 全テスト実行確認
  - 全テストが通ることを確認し、不明点があればユーザーに質問する。

## 備考

- `*` 付きタスクはオプションであり、MVP では省略可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- チェックポイントで段階的に検証を実施
- プロパティテストは設計書の正当性プロパティ（Property 1〜20）に対応
- ユニットテストは PBT で網羅しにくい項目（CLI パース、出力フォーマット等）を補完
