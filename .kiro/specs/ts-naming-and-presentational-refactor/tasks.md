# 実装計画: TypeScript ファイル命名統一 & Container/Presentational 分離

## 概要

設計書の7フェーズ実行計画に基づき、Audit Tool の実装→ガイドライン拡張→命名修正→Container/Presentational 分離→CI 統合の順で実装する。各タスクは TypeScript で記述し、`ts-morph` + `fast-check` を使用する。

## タスク

- [x] 1. Audit Tool のコアインターフェースとプロジェクト構造のセットアップ
  - [x] 1.1 `scripts/naming-audit.ts` のエントリポイントと型定義を作成する
    - [ ] 1.1.1 `scripts/naming-audit/types.ts` にコア型定義を作成する
      - `FileEntry`（absolutePath, relativePath, subPackage, extension）
      - `FileScannerOptions`（targetDirs, excludePatterns）
      - `ExportKind`, `ExportInfo`（name, kind, isDefault）
      - `ComponentMetrics`（jsxLineCount, hookCallCount, usesReactMemo, hookNames）
      - `FileAnalysis`（file, primaryExport, exports, isReExportOnly, componentMetrics）
      - _要件: 1.1, 1.2_
    - [x] 1.1.2 `scripts/naming-audit/types.ts` にルール・違反関連の型定義を作成する
      - `Severity`（'error' | 'warning'）
      - `InconsistencyPattern`（1 | 2 | 3 | 4 | 5 | 6）
      - `Violation`（file, pattern, severity, message, suggestedRename）
      - `Rule` インターフェース（name, evaluate）
      - `RuleEngineConfig`（routerExceptionPaths）
      - _要件: 1.1, 1.2_
    - [x] 1.1.3 `scripts/naming-audit/types.ts` にデータモデル型定義を作成する
      - `FileRole` 型（component, view, container, hook, stateHook, types, constants, utils, validators, index, internal, impl, core, other）
      - `FileClassification`（file, detectedRole, expectedRole, primaryExportName, expectedFileName）
      - `AuditSummary`（subPackage, totalFiles, violations, warnings, compliant）
      - _要件: 1.1, 1.2_
    - [x] 1.1.4 CLI エントリポイント `scripts/naming-audit.ts` のスケルトンを作成する
      - `--ci` フラグ、`--format json|table`、`--target <dir>` オプションの引数パース
      - FileScanner → ExportAnalyzer → RuleEngine → ViolationReporter のパイプライン呼び出しスタブ
      - 終了コード制御（0=pass, 1=error違反あり, 2=ディレクトリ不存在）
      - _要件: 1.1, 1.2, 1.3_

  - [x] 1.2 `FileScanner` モジュールを実装する
    - `scripts/naming-audit/fileScanner.ts` を作成
    - `scanFiles(options: FileScannerOptions): FileEntry[]` を実装
    - 対象ディレクトリ: `app/src/`, `packages/*/src/`, `plugins/*-plugin/src/`
    - `dist/`, `*.d.ts`, `__tests__/` を除外
    - _要件: 1.1_

  - [x] 1.3 `ExportAnalyzer` モジュールを実装する
    - `scripts/naming-audit/exportAnalyzer.ts` を作成
    - `ts-morph` を使用して各ファイルの export 情報を解析
    - `primaryExport`, `isReExportOnly`, `componentMetrics`（JSX 行数・hooks 呼び出し数）を算出
    - _要件: 1.1, 1.2_

- [x] 2. RuleEngine の各ルール実装
  - [x] 2.1 `PrimaryExportRule`（パターン 1: Primary_Export 不一致）を実装する
    - `scripts/naming-audit/rules/primaryExportRule.ts` を作成
    - ファイル名と主エクスポートシンボル名の一致を検証
    - 不一致時に `suggestedRename` を生成
    - _要件: 1.2, 2.1_

  - [x] 2.2 `RoleSuffixRule`（パターン 2: 役割サフィックス不統一）を実装する
    - `scripts/naming-audit/rules/roleSuffixRule.ts` を作成
    - 型定義→`*Types.ts`/`types.ts`、定数→`*Constants.ts`/`constants.ts`、ユーティリティ→`*Utils.ts`/`utils.ts` の正規化を検証
    - _要件: 1.2, 3.1, 3.2, 3.3_

  - [x] 2.3 `ImplSuffixRule`（パターン 4: `.core.ts`/`.internal.ts`/`.impl.ts` 不適切使用）を実装する
    - `scripts/naming-audit/rules/implSuffixRule.ts` を作成
    - `.core.ts` がアルゴリズム中核以外で使用されている場合を検出
    - _要件: 1.2, 4.1, 4.4_

  - [x] 2.4 `ViewPatternRule`（パターン 5, 6: Container/Presentational 混在・View パターン不統一）を実装する
    - `scripts/naming-audit/rules/viewPatternRule.ts` を作成
    - hooks を含まない `.tsx` が `*View.tsx` サフィックスを持たない場合を検出
    - re-export のみのラッパーファイル（パターン B）を検出
    - _要件: 1.2, 5.3, 7.1_

  - [x] 2.5 `SeparationThresholdRule`（分離閾値判定）を実装する
    - `scripts/naming-audit/rules/separationThresholdRule.ts` を作成
    - JSX 行数 > 50 または hooks 呼び出し数 > 2 の場合に分離推奨を報告
    - _要件: 1.2, 7.4_

  - [x] 2.6 `RuleEngine` と `RouterExceptionFilter` を実装する
    - `scripts/naming-audit/ruleEngine.ts` を作成
    - 全ルールを統合し `evaluateRules()` を実装
    - `app/src/router/**` 配下は `severity: 'warning'` に降格
    - _要件: 1.1, 1.4_

- [x] 3. ViolationReporter と CLI 統合
  - [x] 3.1 `ViolationReporter` を実装する
    - `scripts/naming-audit/violationReporter.ts` を作成
    - Console 出力（テーブル形式 / JSON 形式）を実装
    - CI 用終了コード（0=pass, 1=error違反あり, 2=ディレクトリ不存在）を実装
    - _要件: 1.1, 1.2, 1.3_

  - [x] 3.2 CLI エントリポイントを完成させる
    - `scripts/naming-audit.ts` で FileScanner → ExportAnalyzer → RuleEngine → ViolationReporter のパイプラインを接続
    - `--ci` フラグ、`--format json|table`、`--target <dir>` オプションを実装
    - _要件: 1.1, 1.2, 1.3_

- [x] 4. Audit Tool のプロパティベーステスト
  - [ ]* 4.1 Property 1: 命名違反の検出と推奨改名の正確性のプロパティテストを書く
    - **Property 1: 命名違反の検出と推奨改名の正確性**
    - `fast-check` で任意のファイルパス + export シンボルの組み合わせを生成し、`evaluateRules` が有効な `InconsistencyPattern`（1〜6）と空でない `suggestedRename` を返すことを検証
    - **検証対象: 要件 1.1, 1.2**

  - [ ]* 4.2 Property 2: ルーター例外パスの警告レベル分類のプロパティテストを書く
    - **Property 2: ルーター例外パスの警告レベル分類**
    - `fast-check` で `app/src/router/**` 配下の任意パスを生成し、全違反が `severity: 'warning'` であることを検証
    - **検証対象: 要件 1.4**

  - [ ]* 4.3 Property 3: 役割サフィックスの正規化のプロパティテストを書く
    - **Property 3: 役割サフィックスの正規化**
    - `fast-check` で単一役割ファイル（型定義のみ / 定数のみ / ユーティリティのみ）を生成し、推奨サフィックスが `*Types.ts`/`types.ts`、`*Constants.ts`/`constants.ts`、`*Utils.ts`/`utils.ts` のいずれかであることを検証
    - **検証対象: 要件 3.1, 3.2, 3.3**

  - [ ]* 4.4 Property 4: View サフィックス検出のプロパティテストを書く
    - **Property 4: View サフィックス検出**
    - `fast-check` で hooks を含まない `.tsx` コンポーネントを生成し、`*View.tsx` サフィックスがない場合にパターン 6 違反が検出されることを検証
    - **検証対象: 要件 5.3**

  - [ ]* 4.5 Property 5: 分離閾値判定のプロパティテストを書く
    - **Property 5: 分離閾値判定**
    - `fast-check` で任意の `jsxLineCount`・`hookCallCount` を生成し、閾値（JSX ≤ 50 かつ hooks ≤ 2 → 分離不要、それ以外 → 分離推奨）が正しく判定されることを検証
    - **検証対象: 要件 7.4**

  - [ ]* 4.6 Audit Tool のユニットテストを書く
    - `ExportAnalyzer` の既知パターン（re-export ラッパー、型定義集約等）のテスト
    - 各 `InconsistencyPattern` の具体的な違反例・非違反例のテスト
    - `ComponentMetrics` の JSX 行数・hooks 呼び出し数カウントのテスト
    - Router 例外パス（`app/src/router/routes/dialog/dialogRoutes.tsx` 等）のテスト
    - _要件: 1.1, 1.2, 1.4_

- [x] 5. チェックポイント — Audit Tool 完成確認
  - 全テストがパスすることを確認し、ユーザーに質問があれば確認する。
  - c` を実行し、現在のコードベースの違反一覧を確認する。

- [x] 6. 命名ガイドラインの `.tsx` 拡張
  - [x] 6.1 `docs/ts-file-naming-guideline.md` に `.tsx` ファイル命名規約セクションを追加する
    - 対象範囲に `*.tsx` を追加（現在は除外されている）
    - コンポーネントファイルは PascalCase（`ComponentName.tsx`）
    - View サフィックスの使用条件（`*View.tsx` = Presentational）
    - Container/Presentational の命名パターン（`ComponentName.tsx` + `ComponentNameView.tsx` + `useComponentNameState.ts`）
    - 分離判断基準（JSX 50行超 or hooks 呼び出し3個以上 → 分離推奨）
    - _要件: 9.1, 9.2, 9.3_

  - [x] 6.2 `AGENTS.md` の関連セクションを更新する
    - `docs/ts-file-naming-guideline.md` の参照箇所に `.tsx` 対応の旨を追記
    - _要件: 9.4_

- [x] 7. チェックポイント — ガイドライン拡張確認
  - ガイドラインの内容が設計書と整合していることを確認し、ユーザーに質問があれば確認する。

- [x] 8. `packages/*` 命名修正
  - [ ] 8.1 Audit Tool を `packages/` に対して実行し、違反一覧を取得する
    - `pnpm tsx scripts/naming-audit.ts --target packages` で違反を確認
    - パッケージごとの修正計画を作成
    - _要件: 1.1, 2.1_

  - [ ] 8.2 各パッケージの命名違反を修正する（パッケージごとに1PR）
    - `git mv` でファイルをリネーム
    - 同一 PR 内で全 import パスを更新
    - re-export ラッパーがあれば削除し実体ファイルをリネーム
    - `index.ts` の import パスも同時更新
    - _要件: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.5_

- [ ] 9. `plugins/*` 命名修正
  - [ ] 9.1 Audit Tool を `plugins/` に対して実行し、違反一覧を取得する
    - `pnpm tsx scripts/naming-audit.ts --target plugins` で違反を確認
    - プラグインごとの修正計画を作成
    - _要件: 1.1, 2.1_

  - [ ] 9.2 各プラグインの命名違反を修正する（プラグインごとに1PR）
    - `git mv` でファイルをリネーム
    - 同一 PR 内で全 import パスを更新
    - `.core.ts` ファイルの精査と改名（hook 内部実装はサブディレクトリへ移動）
    - re-export ラッパーの削除と実体ファイルのリネーム
    - _要件: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.5_

- [ ] 10. `app/src` 命名修正
  - [ ] 10.1 Audit Tool を `app/src/` に対して実行し、違反一覧を取得する
    - `pnpm tsx scripts/naming-audit.ts --target app/src` で違反を確認
    - `app/src/router/**` の警告レベル報告を確認（ルーター規約例外）
    - ディレクトリごとの修正計画を作成
    - _要件: 1.1, 1.4, 2.1_

  - [ ] 10.2 各ディレクトリの命名違反を修正する（ディレクトリごとに1PR）
    - `git mv` でファイルをリネーム
    - 同一 PR 内で全 import パスを更新
    - `app/src/router/**` はルーター規約を優先し、命名変更が必要な場合はルーティング仕様への影響を確認
    - _要件: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 8.1, 8.2, 8.3, 8.5_

- [ ] 11. チェックポイント — 命名修正完了確認
  - Audit Tool を全体に対して再実行し、命名違反が解消されていることを確認する。
  - `pnpm lint && pnpm typecheck && pnpm test` で回帰がないことを確認する。
  - ユーザーに質問があれば確認する。

- [ ] 12. Container/Presentational 分離
  - [ ] 12.1 分離対象コンポーネントの一覧を Audit Tool で取得する
    - `SeparationThresholdRule` の結果から、JSX 行数 > 50 または hooks 呼び出し数 > 2 のコンポーネントを抽出
    - コンポーネント群ごとの分離計画を作成
    - _要件: 5.1, 7.4_

  - [ ] 12.2 各コンポーネント群の Container/Presentational 分離を実施する（コンポーネント群ごとに1PR）
    - パターン A に統一: `ComponentName.tsx`（Container）+ `ComponentNameView.tsx`（Presentational）+ `useComponentNameState.ts`（State hook）
    - Container ロジックを `use*State.ts` に抽出
    - Presentational コンポーネントに `React.memo` を適用
    - `displayName` を設定
    - パターン B（re-export ラッパー）は削除し実体ファイルをリネーム
    - JSX 50行以下かつ hooks 2個以下のコンポーネントは分離せず `React.memo` のみ適用し、コメントで理由を明記
    - _要件: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.4, 7.1, 7.2, 7.3, 7.4_

  - [ ] 12.3 `React.memo` 適用時の参照安定化を実施する
    - Container 側で `useMemo` / `useCallback` による props の参照安定化
    - `React.memo` の第2引数（カスタム比較関数）は原則使用しない
    - _要件: 6.2, 6.4_

  - [ ]* 12.4 分離後のコンポーネントのユニットテストを書く
    - `React.memo` 適用によるテスト失敗があれば修正
    - Container/Presentational 分離後の props 受け渡しのテスト
    - _要件: 6.3_

- [ ] 13. チェックポイント — Container/Presentational 分離完了確認
  - `pnpm lint && pnpm typecheck && pnpm test` で回帰がないことを確認する。
  - Audit Tool を再実行し、View パターン違反が解消されていることを確認する。
  - ユーザーに質問があれば確認する。

- [ ] 14. CI 統合
  - [ ] 14.1 GitHub Actions ワークフローに Audit Tool を統合する
    - `.github/workflows/naming-audit.yml` を作成（または既存ワークフローに追加）
    - `pnpm tsx scripts/naming-audit.ts --ci` を実行し、exit code 1 で PR をブロック
    - _要件: 1.3_

  - [ ]* 14.2 CI 統合のテストを実施する
    - ワークフローが正しく動作することを確認
    - 命名違反のあるファイルを追加した場合に CI が失敗することを確認
    - _要件: 1.3_

- [ ] 15. 最終チェックポイント — 全体完了確認
  - 全テストがパスすることを確認し、ユーザーに質問があれば確認する。
  - Audit Tool の全体実行で違反が 0（warning のみ許容）であることを確認する。

## 備考

- `*` 付きタスクはオプションであり、MVP では省略可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- チェックポイントでインクリメンタルな検証を実施
- プロパティテストは設計書の正確性プロパティ（Property 1〜5）を検証
- ユニットテストは具体例とエッジケースを検証
- Phase 3〜5（タスク 8〜10）は並行実施可能
- Phase 6（タスク 12）は Phase 3〜5 完了後に実施（ファイル名安定後に分離）
