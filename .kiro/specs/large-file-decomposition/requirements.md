# 要件定義書: 大規模ファイル分割 (Large File Decomposition)

## はじめに

600行以上の `*.ts` / `*.tsx` ファイル（テストファイル以外）を対象に、責務の分離とコードの可読性向上を目的としたファイル分割を行う。対象スコープは `app/src`、`packages/*/src`、`plugins/*-plugin/src` 配下の40ファイル（最大1772行）。既存の命名ガイドライン（`docs/ts-file-naming-guideline.md`）、Audit Tool（`scripts/naming-audit.ts`）、Container/Presentational 分離パターンに準拠しつつ、分割後のファイルが単一責務・600行以下となることを目指す。

## 用語集

- **Decomposition_Analyzer**: 大規模ファイルの構造を解析し、分割候補を特定するツール
- **Split_Plan**: ファイル分割の計画。元ファイル・分割先ファイル・移動対象シンボルを定義する
- **Cohesion_Group**: 相互に強く依存する関数・型の集合。同一ファイルに留めるべき単位
- **Naming_Guideline**: `docs/ts-file-naming-guideline.md` に定義されたファイル命名規約
- **Audit_Tool**: `scripts/naming-audit.ts` に実装された命名規約検証ツール
- **Threshold**: ファイル分割の判定基準となる行数（600行）
- **Target_Scope**: 分割対象のディレクトリ群（`app/src`、`packages/*/src`、`plugins/*-plugin/src`）
- **Symbol**: ファイル内のエクスポートされた関数・クラス・型・定数などの識別子
- **Dependency_Graph**: ファイル内シンボル間の参照関係を表すグラフ
- **Container_Component**: hooks を呼び出し、Presentational コンポーネントに props を渡す `.tsx` ファイル
- **Presentational_Component**: props のみに依存し hooks を使用しない `*View.tsx` ファイル

## 要件

### 要件 1: 分割対象ファイルの検出

**ユーザーストーリー:** 開発者として、600行以上の大規模ファイルを自動検出したい。分割作業の優先順位付けと進捗管理を効率化するためである。

#### 受入基準

1. WHEN Decomposition_Analyzer が Target_Scope に対して実行されたとき、THE Decomposition_Analyzer SHALL テストファイル（`__tests__/` 配下、`*.test.ts`、`*.test.tsx`、`*.spec.ts`、`*.spec.tsx`）を除外した上で、Threshold（600行）以上の `*.ts` / `*.tsx` ファイルを一覧として出力する
2. THE Decomposition_Analyzer SHALL 各検出ファイルについて、ファイルパス・行数・エクスポートされた Symbol 数・推定 Cohesion_Group 数を報告する
3. THE Decomposition_Analyzer SHALL 検出結果を行数の降順でソートして出力する
4. WHEN `--format json` オプションが指定されたとき、THE Decomposition_Analyzer SHALL 検出結果を JSON 形式で出力する
5. WHEN `--format table` オプションが指定されたとき、THE Decomposition_Analyzer SHALL 検出結果をテーブル形式で出力する

### 要件 2: ファイル内構造解析

**ユーザーストーリー:** 開発者として、大規模ファイル内のシンボル間依存関係を可視化したい。適切な分割境界を判断するためである。

#### 受入基準

1. WHEN Decomposition_Analyzer がファイルを解析するとき、THE Decomposition_Analyzer SHALL ファイル内の全エクスポート Symbol（関数・クラス・型・定数・変数）を抽出する
2. WHEN Decomposition_Analyzer がファイルを解析するとき、THE Decomposition_Analyzer SHALL Symbol 間のファイル内参照関係（Dependency_Graph）を構築する
3. THE Decomposition_Analyzer SHALL Dependency_Graph に基づき、相互依存の強い Symbol 群を Cohesion_Group として自動分類する
4. WHEN 循環参照が Cohesion_Group 間に存在するとき、THE Decomposition_Analyzer SHALL 該当する循環参照を警告として報告する

### 要件 3: 分割計画の生成

**ユーザーストーリー:** 開発者として、分割計画を自動生成したい。手動での分割境界の判断コストを削減するためである。

#### 受入基準

1. WHEN Decomposition_Analyzer が Cohesion_Group を特定した後、THE Decomposition_Analyzer SHALL 各 Cohesion_Group に対して分割先ファイル名を Naming_Guideline に準拠して提案する Split_Plan を生成する
2. THE Split_Plan SHALL 分割後の各ファイルが Threshold（600行）以下となるように Symbol を配分する
3. THE Split_Plan SHALL 分割後の各ファイルが Naming_Guideline の「1ファイル1主役」原則に準拠するように構成する
4. WHEN 元ファイルが `.tsx` であり Container_Component と Presentational_Component の混在が検出されたとき、THE Split_Plan SHALL Container/Presentational 分離パターン（`ComponentName.tsx` + `ComponentNameView.tsx` + `useComponentNameState.ts`）に従った分割を提案する
5. THE Split_Plan SHALL 分割後のファイル間で循環 import が発生しないことを保証する
6. WHEN 元ファイルにヘルパー関数群（3個以上の純関数ユーティリティ）が含まれるとき、THE Split_Plan SHALL ヘルパー関数群を専用のユーティリティファイルへの分離を提案する
7. WHEN 元ファイルに型定義（3個以上の type / interface）が含まれるとき、THE Split_Plan SHALL 型定義を専用の `types.ts` ファイルへの分離を提案する

### 要件 4: 分割計画の検証

**ユーザーストーリー:** 開発者として、分割計画が既存の規約に準拠していることを自動検証したい。分割後の規約違反を防止するためである。

#### 受入基準

1. THE Decomposition_Analyzer SHALL Split_Plan 内の全分割先ファイル名が Naming_Guideline に準拠していることを検証する
2. THE Decomposition_Analyzer SHALL Split_Plan 内の全分割先ファイルが Threshold（600行）以下であることを検証する
3. WHEN Split_Plan が Naming_Guideline に違反するファイル名を含むとき、THE Decomposition_Analyzer SHALL 違反内容と修正案を報告する
4. THE Decomposition_Analyzer SHALL Split_Plan の分割後に、元ファイルの全パブリック API（エクスポート）が分割先ファイルのいずれかから再エクスポートなしでアクセス可能であることを検証する
5. WHEN Split_Plan の分割後にファイル間循環 import が検出されたとき、THE Decomposition_Analyzer SHALL 循環の詳細と解消案を報告する

### 要件 5: `.ts` ファイルの分割パターン

**ユーザーストーリー:** 開発者として、`.ts` ファイルの分割に一貫したパターンを適用したい。分割後のコード構造を予測可能にするためである。

#### 受入基準

1. WHEN 元ファイルが単一の大規模関数とそのヘルパー関数群で構成されるとき、THE Split_Plan SHALL メイン関数を元ファイルに残し、ヘルパー関数群をサブディレクトリ内の責務別ファイルに分離する構成を提案する
2. WHEN 元ファイルが複数の独立した公開関数で構成されるとき、THE Split_Plan SHALL 各公開関数を Cohesion_Group 単位で個別ファイルに分離する構成を提案する
3. WHEN 元ファイルが Hook（`use*.ts`）であるとき、THE Split_Plan SHALL Hook 整理ルール（AGENTS.md の Hook 4分類）に従い、子孫ロジックをサブディレクトリに分離する構成を提案する
4. THE Split_Plan SHALL 分割後のディレクトリ構成において、`index.ts` を再エクスポート専用入口としてのみ使用する

### 要件 6: `.tsx` ファイルの分割パターン

**ユーザーストーリー:** 開発者として、`.tsx` ファイルの分割に Container/Presentational パターンを一貫して適用したい。UI コンポーネントの責務を明確にするためである。

#### 受入基準

1. WHEN 元ファイルが JSX 行数 50行超または hooks 呼び出し数 2個超のコンポーネントを含むとき、THE Split_Plan SHALL Container/Presentational 分離パターンを適用した分割を提案する
2. WHEN 元ファイルが複数のコンポーネント定義を含むとき、THE Split_Plan SHALL 各コンポーネントを個別ファイルに分離する構成を提案する
3. WHEN 元ファイルにレンダリング用ヘルパー関数（`render*` プレフィックス）が含まれるとき、THE Split_Plan SHALL ヘルパー関数を Presentational_Component として `*View.tsx` に分離する構成を提案する
4. THE Split_Plan SHALL 分割後の Presentational_Component に `React.memo` の適用と `displayName` の設定を含める

### 要件 7: 分割実行の安全性

**ユーザーストーリー:** 開発者として、分割作業が既存の動作を壊さないことを保証したい。安全にリファクタリングを進めるためである。

#### 受入基準

1. THE Split_Plan SHALL 分割対象ファイルの全パブリック API のエクスポートシグネチャが分割前後で変化しないことを保証する
2. WHEN 分割対象ファイルが他ファイルから import されているとき、THE Split_Plan SHALL import 元ファイルの更新が必要な箇所を一覧として出力する
3. THE Split_Plan SHALL 分割後に `pnpm typecheck` が成功することを検証基準として定義する
4. THE Split_Plan SHALL 分割後に `pnpm lint` が成功することを検証基準として定義する
5. IF 分割対象ファイルに対応するテストファイルが存在するとき、THEN THE Split_Plan SHALL テストファイルの import パス更新計画を含める

### 要件 8: Audit Tool との統合

**ユーザーストーリー:** 開発者として、分割結果が既存の Audit Tool で検証可能であることを保証したい。命名規約の一貫性を維持するためである。

#### 受入基準

1. THE Decomposition_Analyzer SHALL 分割計画の生成時に Audit_Tool のルールエンジンを参照し、分割先ファイル名の命名規約準拠を事前検証する
2. WHEN 分割が完了したとき、THE Decomposition_Analyzer SHALL Audit_Tool を分割後のファイル群に対して実行し、命名違反が 0 件であることを検証する
3. THE Decomposition_Analyzer SHALL Audit_Tool の `--ci` モードと同様の終了コード体系（0=pass、1=違反あり）を採用する

### 要件 9: 進捗管理と優先順位付け

**ユーザーストーリー:** 開発者として、40ファイルの分割作業を優先順位付けして段階的に進めたい。リスクの高いファイルから着手するためである。

#### 受入基準

1. THE Decomposition_Analyzer SHALL 各対象ファイルに対して優先度スコア（行数 × エクスポート Symbol 数）を算出する
2. THE Decomposition_Analyzer SHALL 優先度スコアの降順で分割推奨順序を出力する
3. WHEN `--batch <n>` オプションが指定されたとき、THE Decomposition_Analyzer SHALL 上位 n 件のファイルのみを対象とした Split_Plan を生成する
4. THE Decomposition_Analyzer SHALL 分割済みファイルの追跡機能を提供し、未分割ファイルの残数を報告する
