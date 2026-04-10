# 要件定義書: TypeScript ファイル命名統一 & Container/Presentational 分離

## はじめに

本リファクタリングは2つの目標を持つ。

1. **ファイル命名規約の統一**: `docs/ts-file-naming-guideline.md` に定義された命名規約を、`app/src/`・`packages/*/src/`・`plugins/*-plugin/src/` 配下の全 `*.ts` / `*.tsx` ファイルに適用し、不整合を解消する。
2. **Container/Presentational 分離と React.memo 最適化**: Container（状態管理・副作用）と Presentational（表示専用）の責務が混在しているコンポーネントを分離し、Presentational コンポーネントに `React.memo` を適用してレンダリング効率を向上させる。

## 用語集

- **Naming_Guideline**: `docs/ts-file-naming-guideline.md` に定義されたファイル命名規約
- **Audit_Tool**: 命名規約違反を検出するスクリプトまたは lint ルール
- **Inconsistency_Pattern**: Naming_Guideline に違反するファイル命名パターンの分類
- **Container_Component**: React hooks（useState, useEffect, useAtom 等）を使用して状態管理・副作用・データ取得を行うコンポーネント
- **Presentational_Component**: props のみに依存し、状態管理・副作用を持たない表示専用コンポーネント
- **View_Suffix**: Presentational コンポーネントのファイル名に付与する `*View.tsx` サフィックス
- **State_Hook**: Container ロジックを抽出した `use*State.ts` または `use*ViewModel.ts` フック
- **Sub_Package**: `app/src/`、`packages/*/src/`、`plugins/*-plugin/src/` のいずれかのディレクトリ
- **Primary_Export**: ファイルの主たるエクスポートシンボル

## 不整合パターン一覧

本セクションでは、コードベースで発見された命名不整合パターンを分類し、具体的な修正例を示す。

### 不整合パターン 1: Primary_Export とファイル名の不一致

ファイル名から主エクスポートを推測できないケース。

**例（Before）**:
```
plugins/shape-plugin/src/ui/components/preview/ShapePreviewStep.tsx
  → 中身は `export { ShapePreviewStep } from './ShapePreviewStepView.js'` のみ（re-export ラッパー）
```

**例（After）**:
```
ShapePreviewStep.tsx を削除し、ShapePreviewStepView.tsx を ShapePreviewStep.tsx にリネーム。
import 元を直接参照に変更。
```

### 不整合パターン 2: 役割サフィックスの不統一

同一プロジェクト内で型定義ファイルの命名が統一されていないケース。

**例（Before）**:
```
plugins/shape-plugin/src/ui/components/ShapeDialogStepProps.ts     → 型定義だが types.ts でも *Types.ts でもない
plugins/location-plugin/src/ui/components/steps/locationTypes.ts   → camelCase の types ファイル
plugins/location-plugin/src/ui/components/batch/locationMapPreviewTypes.ts → camelCase の types ファイル
```

**例（After）**:
```
plugins/shape-plugin/src/ui/components/shapeDialogStepTypes.ts     → 役割サフィックス統一
plugins/location-plugin/src/ui/components/steps/locationStepTypes.ts → ドメイン名 + Types サフィックス
plugins/location-plugin/src/ui/components/batch/locationMapPreviewTypes.ts → 既に適切（ドメイン名付き）
```

### 不整合パターン 3: ケーシング規約の混在

同一ディレクトリ内で PascalCase と camelCase が混在しているケース。

**例（Before）**:
```
plugins/shape-plugin/src/ui/components/build-config/
  CacheManagementSection.tsx          → PascalCase（コンポーネント）
  useGeometryConfigSectionView.ts     → camelCase（hook）
  UrlBuildConfigRulesSection.tsx       → PascalCase（コンポーネント）

plugins/location-plugin/src/ui/components/steps/
  LocationBuildParametersStep.tsx      → PascalCase（コンポーネント）
  locationMapPreviewConstants.ts       → camelCase（定数）
  locationMapPreviewUtils.ts           → camelCase（ユーティリティ）
  locationTypes.ts                     → camelCase（型定義）
```

**規約の明確化**:
```
コンポーネント（.tsx）: PascalCase（ComponentName.tsx）
Hook（.ts）: camelCase（useXxx.ts）
型定義（.ts）: camelCase（xxxTypes.ts）
定数（.ts）: camelCase（xxxConstants.ts）
ユーティリティ（.ts）: camelCase（xxxUtils.ts）
```

### 不整合パターン 4: `.core.ts` サフィックスの理由なき使用

`.core.ts` サフィックスが「アルゴリズム中核の切り出し」以外の目的で使われているケース。

**例（Before）**:
```
plugins/shape-plugin/src/ui/components/country-selection/useShapeCountrySelectionStep.core.ts
plugins/shape-plugin/src/ui/components/preview/useShapePreviewStep.core.ts
plugins/shape-plugin/src/ui/components/preview/useShapePreviewStepView.core.ts
```

**例（After）**:
```
各 .core.ts の内容を精査し、以下のいずれかに改名:
  - 親 hook の内部実装 → useShapeCountrySelectionStep/ ディレクトリ配下に移動
  - 独立した純関数群 → ドメイン名を付与した具体名に改名
```

### 不整合パターン 5: Container/Presentational 混在コンポーネント

1つの `.tsx` ファイル内で hooks による状態管理と JSX レンダリングが密結合しているケース。

**例（Before）**:
```typescript
// CacheManagementSection.tsx — hooks と JSX が混在
export const CacheManagementSection: React.FC<Props> = ({ config, onChange, ... }) => {
  const { t } = useTranslation('shape-plugin');
  const { update: updateGeometryConfig } = useGeometryConfigSection({ config, onChange });
  // ... 状態変換ロジック ...
  return ( <Accordion> ... 200行以上の JSX ... </Accordion> );
};
```

**例（After）**:
```typescript
// useCacheManagementSectionState.ts — Container ロジック
export function useCacheManagementSectionState(props: Props) {
  const { t } = useTranslation('shape-plugin');
  const { update: updateGeometryConfig } = useGeometryConfigSection({ ... });
  return { t, updateGeometryConfig, hoverCardSx, ... };
}

// CacheManagementSectionView.tsx — Presentational（React.memo 適用）
export const CacheManagementSectionView = React.memo<ViewProps>(({ ... }) => {
  return ( <Accordion> ... </Accordion> );
});

// CacheManagementSection.tsx — Container（組み立て）
export const CacheManagementSection: React.FC<Props> = (props) => {
  const state = useCacheManagementSectionState(props);
  return <CacheManagementSectionView {...state} />;
};
```

### 不整合パターン 6: View パターンの不統一

一部のコンポーネントでは `*View.tsx` パターンが導入済みだが、命名規約やディレクトリ構造が統一されていないケース。

**例（現状の混在）**:
```
# パターン A: View ファイルが存在し分離済み
BuildSessionStageCard/
  BuildSessionStageCard.tsx              → Container
  BuildSessionStageCardView.tsx          → Presentational
  useBuildSessionStageCardState.ts       → State hook

# パターン B: View ファイルが存在するが re-export のみ
preview/
  ShapePreviewStep.tsx                   → re-export のみ
  ShapePreviewStepView.tsx               → 実体（hooks 混在）

# パターン C: View 分離なし（大多数）
build-config/
  ShapeBuildConfigStep.tsx               → hooks + JSX 混在
  CacheManagementSection.tsx             → hooks + JSX 混在
```

**統一後の規約**:
```
パターン A を標準とし、全コンポーネントに適用:
  ComponentName/
    ComponentName.tsx                    → Container（hook 呼び出し + View 組み立て）
    ComponentNameView.tsx                → Presentational（React.memo 適用）
    useComponentNameState.ts             → State hook（Container ロジック）
```

## 要件

### 要件 1: 命名不整合の検出と一覧化

**ユーザーストーリー:** 開発者として、命名規約に違反しているファイルを一覧で把握したい。リファクタリング作業の対象範囲を明確にし、作業漏れを防ぐためである。

#### 受入条件

1. WHEN Audit_Tool を実行した場合、THE Audit_Tool SHALL 全 Sub_Package 配下の `*.ts` / `*.tsx` ファイルを走査し、Naming_Guideline に違反するファイルを一覧出力する
2. THE Audit_Tool SHALL 各違反ファイルについて、該当する Inconsistency_Pattern の番号と推奨改名先を出力する
3. WHEN 新規ファイルが追加された場合、THE Audit_Tool SHALL CI パイプラインで命名違反を検出し、ビルドを失敗させる
4. IF Audit_Tool が `app/src/router/**` 配下のファイルを検出した場合、THEN THE Audit_Tool SHALL ルーター規約例外として警告レベルで報告し、エラーとして扱わない

### 要件 2: Primary_Export 一致ルールの適用

**ユーザーストーリー:** 開発者として、ファイル名から主エクスポートを即座に推測したい。コードナビゲーションの効率を向上させるためである。

#### 受入条件

1. THE Refactoring_Process SHALL 全 Sub_Package 配下で Primary_Export とファイル名が不一致のファイルを改名する
2. WHEN ファイルを改名した場合、THE Refactoring_Process SHALL 同一 PR 内で全 import パスを更新する
3. WHEN re-export のみのラッパーファイルが存在する場合、THE Refactoring_Process SHALL ラッパーファイルを削除し、実体ファイルを正しい名前にリネームする
4. IF 改名対象ファイルが `index.ts` の re-export 元である場合、THEN THE Refactoring_Process SHALL `index.ts` の import パスも同時に更新する

### 要件 3: 役割サフィックスの統一

**ユーザーストーリー:** 開発者として、ファイルの役割（型定義・定数・ユーティリティ）をファイル名から判別したい。ファイル検索時の認知負荷を下げるためである。

#### 受入条件

1. THE Refactoring_Process SHALL 型定義集約ファイルを `*Types.ts` または `types.ts`（ディレクトリ境界内で責務が明確な場合）に統一する
2. THE Refactoring_Process SHALL 定数集約ファイルを `*Constants.ts` または `constants.ts` に統一する
3. THE Refactoring_Process SHALL ユーティリティ集約ファイルを `*Utils.ts` または `utils.ts` に統一する
4. WHEN 単一の型定義ファイルが複数ドメインの型を含む場合、THE Refactoring_Process SHALL ドメインごとにファイルを分割する

### 要件 4: `.core.ts` / `.internal.ts` / `.impl.ts` サフィックスの適正化

**ユーザーストーリー:** 開発者として、実装詳細サフィックスが正当な理由で使われていることを確認したい。サフィックスの乱用による検索性低下を防ぐためである。

#### 受入条件

1. THE Refactoring_Process SHALL 全 `.core.ts` ファイルを精査し、「アルゴリズム中核の切り出し」に該当しないファイルを改名する
2. WHEN `.core.ts` ファイルが hook の内部実装である場合、THE Refactoring_Process SHALL 親 hook のサブディレクトリ配下に移動し、具体的なドメイン名を付与する
3. THE Refactoring_Process SHALL 全 `.internal.ts` / `.impl.ts` ファイルについて、使用理由をコードコメントで明記する
4. IF 実装詳細サフィックスの使用理由が説明不能な場合、THEN THE Refactoring_Process SHALL より具体的なドメイン名へ改名する

### 要件 5: Container/Presentational 分離の実施

**ユーザーストーリー:** 開発者として、コンポーネントの責務を明確に分離したい。テスタビリティの向上と不要な再レンダリングの削減のためである。

#### 受入条件

1. THE Refactoring_Process SHALL hooks による状態管理と JSX レンダリングが混在するコンポーネントを Container_Component と Presentational_Component に分離する
2. THE Refactoring_Process SHALL 分離対象コンポーネントの Container ロジックを State_Hook（`use*State.ts`）に抽出する
3. THE Refactoring_Process SHALL Presentational_Component のファイル名に View_Suffix（`*View.tsx`）を付与する
4. WHILE Container_Component が State_Hook を呼び出す場合、THE Container_Component SHALL State_Hook の戻り値を Presentational_Component の props として渡す
5. IF コンポーネントが既に props のみに依存している場合、THEN THE Refactoring_Process SHALL 分離せず、React.memo の適用のみを行う

### 要件 6: React.memo の適用

**ユーザーストーリー:** 開発者として、Presentational コンポーネントの不要な再レンダリングを防止したい。大規模なコンポーネントツリーでのパフォーマンスを改善するためである。

#### 受入条件

1. THE Refactoring_Process SHALL 全 Presentational_Component に `React.memo` を適用する
2. WHEN Presentational_Component の props にオブジェクト型または関数型が含まれる場合、THE Refactoring_Process SHALL Container_Component 側で `useMemo` / `useCallback` による参照安定化を実施する
3. IF `React.memo` の適用によりテストが失敗する場合、THEN THE Refactoring_Process SHALL テストを修正し、memo 化された振る舞いに対応させる
4. THE Refactoring_Process SHALL `React.memo` の第2引数（カスタム比較関数）を原則使用しない（shallow comparison で十分な props 設計を優先する）

### 要件 7: View パターンの統一

**ユーザーストーリー:** 開発者として、Container/Presentational 分離のディレクトリ構造を統一したい。新規コンポーネント作成時の判断コストを下げるためである。

#### 受入条件

1. THE Refactoring_Process SHALL 既存の View パターン（パターン A / B / C）をパターン A に統一する
2. THE Refactoring_Process SHALL 統一後のディレクトリ構造を以下とする: `ComponentName.tsx`（Container）、`ComponentNameView.tsx`（Presentational）、`useComponentNameState.ts`（State hook）
3. WHEN 既存コンポーネントが re-export のみのラッパー（パターン B）である場合、THE Refactoring_Process SHALL ラッパーを削除し、実体ファイルを適切にリネームする
4. IF コンポーネントが十分に小さく（JSX 50行以下かつ hooks 呼び出し2個以下）分離のメリットが薄い場合、THEN THE Refactoring_Process SHALL 分離せず、コードコメントで理由を明記する

### 要件 8: 改名の安全性保証

**ユーザーストーリー:** 開発者として、ファイル改名によるリグレッションを防止したい。リファクタリングが既存機能を壊さないことを保証するためである。

#### 受入条件

1. THE Refactoring_Process SHALL 各改名を `git mv` で実行し、Git の rename tracking を維持する
2. WHEN ファイルを改名した場合、THE Refactoring_Process SHALL 同一 PR 内で `pnpm lint && pnpm typecheck && pnpm test` を実行し、全てパスすることを確認する
3. THE Refactoring_Process SHALL 1つの PR で1つの Sub_Package のみを対象とし、レビュー負荷を制限する
4. IF 改名により循環依存が発生する場合、THEN THE Refactoring_Process SHALL 改名を中止し、依存関係の整理を先行タスクとして起票する
5. THE Refactoring_Process SHALL 各 PR に改名理由とロールバック方法（rename 戻し）を明記する

### 要件 9: 命名ガイドラインの `.tsx` 拡張

**ユーザーストーリー:** 開発者として、`.tsx` ファイルにも明確な命名規約を持ちたい。現在の `docs/ts-file-naming-guideline.md` は `.ts` のみを対象としており、`.tsx` の規約が不足しているためである。

#### 受入条件

1. THE Refactoring_Process SHALL `docs/ts-file-naming-guideline.md` を拡張し、`.tsx` ファイルの命名規約を追加する
2. THE Naming_Guideline SHALL `.tsx` ファイルについて以下を規定する: コンポーネントファイルは PascalCase、View サフィックスの使用条件、Container/Presentational の命名パターン
3. THE Naming_Guideline SHALL Container/Presentational 分離の判断基準（JSX 行数・hooks 呼び出し数の閾値）を明記する
4. WHEN Naming_Guideline を更新した場合、THE Refactoring_Process SHALL AGENTS.md の関連セクションも同時に更新する
