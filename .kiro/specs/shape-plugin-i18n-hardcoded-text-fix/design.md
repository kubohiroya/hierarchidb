# Shape Plugin i18n Hardcoded Text Fix Bugfix Design

## Overview

Shape pluginにおける2つの問題を修正する：
1. TaskItemCardコンポーネントとGeometry Previewでハードコーディングされた日本語テキストをi18n化する
2. Geometry Preview: SourceステージのFloatingWindowでドラッグ移動・リサイズができない問題を修正する

これらの修正により、多言語対応を完全にし、ユーザビリティを向上させる。

## Glossary

- **Bug_Condition (C)**: ハードコーディングされた日本語テキストが表示される条件、またはFloatingWindowの状態管理が正しく動作しない条件
- **Property (P)**: translate関数を使用したi18n化されたテキスト表示、またはFloatingWindowの正常な状態管理
- **Preservation**: 他のステージやコンポーネントの既存のi18n化された表示と動作
- **TaskItemCard**: `plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemCard.tsx`のコンポーネント
- **buildGeometryTaskOutcomeSummary**: geometry-likeステージのタスク結果サマリーを構築する関数
- **FloatingWindow**: `@hierarchidb/ui-floating-window`パッケージのフローティングウィンドウコンポーネント
- **useFloatingWindow**: FloatingWindowの状態管理を行うカスタムフック

## Bug Details

### Fault Condition

バグは以下の2つの条件で発生する：

1. **i18n化問題**: TaskItemCardでgeometry-likeステージのタスクが完了または失敗状態の時、およびbuildGeometryTaskOutcomeSummaryでタスクサマリーを構築する時に、translate関数を使用せずに日本語テキストがハードコーディングされている。

2. **FloatingWindow状態管理問題**: Geometry Preview: SourceステージのFloatingWindowでドラッグやリサイズ操作を行う時に、useFloatingWindowフックの状態管理が正しく動作せず、変更がすぐに元に戻ってしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UIInteraction
  OUTPUT: boolean
  
  RETURN (input.component === 'TaskItemCard' 
         AND input.stageType === 'geometry-like'
         AND input.taskStatus IN ['completed', 'failed']
         AND input.textDisplayed IN ['失敗', '完了', '試行', 'スキップ', '理由', '有効許容値', '試行回数', '最終データサイズ (F/Pol/V)', '元データサイズ (F/Pol/V)', '頂点削減率', '抽出率', '頂点制限', '失敗理由'])
         OR (input.component === 'FloatingWindow'
         AND input.stage === 'source'
         AND input.operation IN ['drag', 'resize']
         AND input.stateChangeReverted === true)
END FUNCTION
```

### Examples

- TaskItemCardでgeometry-likeステージのタスクが失敗した時に「失敗: 試行 2」と表示される（期待値: translate関数による多言語対応テキスト）
- buildGeometryTaskOutcomeSummaryでスキップされたタスクに「スキップ: データなし」「理由: ソースファイルが見つかりません」と表示される（期待値: translate関数による多言語対応テキスト）
- Geometry Preview: SourceステージのFloatingWindowをドラッグして移動させても、すぐに元の位置に戻ってしまう（期待値: 新しい位置を維持）
- Geometry Preview: SourceステージのFloatingWindowをリサイズしても、すぐに元のサイズに戻ってしまう（期待値: 新しいサイズを維持）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のステージ（geometry-like以外）のタスクの既存のi18n化された表示
- buildSimpleTaskOutcomeSummaryとbuildSourceTaskOutcomeSummaryの既存のi18n化された表示
- TaskItemCardの他の機能（アイコン表示、プログレス表示、詳細表示等）
- Geometry Preview: GeometryステージのFloatingWindowの正常な動作
- 他のFloatingWindow（Sourceステージ以外）の正常な動作

**Scope:**
geometry-likeステージ以外のタスク表示とSourceステージ以外のFloatingWindowは完全に影響を受けない。これには以下が含まれる：
- マウスクリックによるボタン操作
- 他のキーボード入力
- タッチ入力（該当する場合）

## Hypothesized Root Cause

バグ分析に基づく最も可能性の高い問題：

1. **i18n化の欠如**: TaskItemCardとbuildGeometryTaskOutcomeSummaryで日本語テキストが直接ハードコーディングされている
   - TaskItemCard.tsx 144-145行目: `${task.status === 'failed' ? '失敗' : '完了'}: 試行 ${normalizedRetryAttempt}`
   - taskOutcomeSummaryBuilders.ts 335-357行目: `スキップ: ${compact(reason)}`、`理由: ${reason}`等

2. **translate関数の未使用**: 既存のtranslate関数が渡されているにも関わらず、ハードコーディングされたテキストで使用されていない

3. **FloatingWindow状態管理の競合**: useFloatingWindowフックとTaskItemDetailWindowの状態管理の間で競合が発生している
   - initialWindowStateの設定とwindowStateの更新タイミングの問題
   - onStateChangeハンドラーの処理順序の問題

4. **状態の初期化タイミング**: FloatingWindowの初期状態設定が毎回リセットされている可能性

## Correctness Properties

Property 1: Fault Condition - i18n Text Display

_For any_ UI interaction where hardcoded Japanese text is displayed in TaskItemCard or buildGeometryTaskOutcomeSummary, the fixed function SHALL use the translate function to display internationalized text with appropriate fallback values.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Fault Condition - FloatingWindow State Management

_For any_ drag or resize operation on Geometry Preview: Source stage FloatingWindow, the fixed function SHALL maintain the new position and size without reverting to the original state.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation - Non-Geometry Stage Text Display

_For any_ task display that is NOT in geometry-like stages, the fixed function SHALL produce exactly the same internationalized text display as the original function, preserving all existing i18n behavior.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 4: Preservation - Non-Source FloatingWindow Behavior

_For any_ FloatingWindow that is NOT in Source stage, the fixed function SHALL produce exactly the same drag and resize behavior as the original function, preserving all existing functionality.

**Validates: Requirements 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemCard.tsx`

**Function**: `TaskItemCard`

**Specific Changes**:
1. **i18n化の実装**: 144-145行目のハードコーディングされた日本語テキストをtranslate関数を使用した呼び出しに置換
   - `'失敗'` → `translate('task.status.failed', 'Failed')`
   - `'完了'` → `translate('task.status.completed', 'Completed')`
   - `'試行'` → `translate('task.status.attempt', 'Attempt')`

**File**: `plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders.ts`

**Function**: `buildGeometryTaskOutcomeSummary`

**Specific Changes**:
1. **スキップ状態のi18n化**: 335-336行目
   - `'スキップ'` → `translate('task.status.skipped', 'Skipped')`
   - `'理由'` → `translate('task.status.reason', 'Reason')`

2. **完了・失敗状態のi18n化**: 341-357行目
   - `'失敗'` → `translate('task.status.failed', 'Failed')`
   - `'完了'` → `translate('task.status.completed', 'Completed')`
   - `'試行'` → `translate('task.status.attempt', 'Attempt')`
   - `'有効許容値'` → `translate('task.details.effectiveTolerance', 'Effective Tolerance')`
   - `'試行回数'` → `translate('task.details.retryCount', 'Retry Count')`
   - `'最終データサイズ (F/Pol/V)'` → `translate('task.details.finalDataSize', 'Final Data Size (F/Pol/V)')`
   - `'元データサイズ (F/Pol/V)'` → `translate('task.details.originalDataSize', 'Original Data Size (F/Pol/V)')`
   - `'頂点削減率'` → `translate('task.details.vertexReductionRate', 'Vertex Reduction Rate')`
   - `'抽出率'` → `translate('task.details.extractionRate', 'Extraction Rate')`
   - `'頂点制限'` → `translate('task.details.vertexLimit', 'Vertex Limit')`
   - `'失敗理由'` → `translate('task.details.failureReason', 'Failure Reason')`

**File**: `plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemDetailWindow.tsx`

**Function**: `TaskItemDetailWindow`

**Specific Changes**:
1. **FloatingWindow状態管理の修正**: useFloatingWindowフックの使用方法を修正
   - initialWindowStateの設定ロジックを見直し、不要な状態リセットを防ぐ
   - onStateChangeハンドラーの処理順序を調整
   - windowStateの更新タイミングを最適化

2. **状態の永続化設定の調整**: persistKeyの設定を見直し、Sourceステージ固有の状態管理を実装

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従う：まず、修正前のコードでバグを実証する反例を表面化し、次に修正が正しく動作し、既存の動作を保持することを検証する。

### Exploratory Fault Condition Checking

**Goal**: 修正実装前にバグを実証する反例を表面化する。根本原因分析を確認または反証する。反証した場合は、再仮説が必要。

**Test Plan**: 各UIコンテキストでハードコーディングされた日本語テキストの表示とFloatingWindowの状態管理をシミュレートするテストを作成する。修正前のコードでこれらのテストを実行し、失敗を観察して根本原因を理解する。

**Test Cases**:
1. **Geometry Stage Task Status Test**: geometry-likeステージのタスクが完了・失敗状態の時の表示テスト（修正前のコードで失敗）
2. **Geometry Task Summary Test**: buildGeometryTaskOutcomeSummaryでのハードコーディングされたテキスト表示テスト（修正前のコードで失敗）
3. **Source FloatingWindow Drag Test**: SourceステージのFloatingWindowドラッグ操作テスト（修正前のコードで失敗）
4. **Source FloatingWindow Resize Test**: SourceステージのFloatingWindowリサイズ操作テスト（修正前のコードで失敗）

**Expected Counterexamples**:
- ハードコーディングされた日本語テキストが表示される
- translate関数が呼び出されない
- FloatingWindowの位置・サイズ変更がすぐに元に戻る
- 可能な原因: translate関数の未使用、状態管理の競合、初期化タイミングの問題

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正された関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正された関数が元の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: 保持チェックにはプロパティベーステストが推奨される理由：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動単体テストでは見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: まず修正前のコードで非バグ入力の動作を観察し、その動作をキャプチャするプロパティベーステストを作成する。

**Test Cases**:
1. **Non-Geometry Stage Preservation**: geometry-like以外のステージでのタスク表示が修正後も同じ動作を継続することを検証
2. **Other Summary Builder Preservation**: buildSimpleTaskOutcomeSummaryとbuildSourceTaskOutcomeSummaryが修正後も同じ動作を継続することを検証
3. **Non-Source FloatingWindow Preservation**: Sourceステージ以外のFloatingWindowが修正後も同じ動作を継続することを検証
4. **Other TaskItemCard Features Preservation**: TaskItemCardの他の機能が修正後も同じ動作を継続することを検証

### Unit Tests

- geometry-likeステージでのtranslate関数の呼び出しテスト
- 各ハードコーディングされたテキストのi18n化テスト
- FloatingWindowの状態管理テスト（ドラッグ・リサイズ）
- エッジケース（範囲外の値、存在しないボタン等）のテスト

### Property-Based Tests

- ランダムなタスク状態を生成してi18n化が正しく動作することを検証
- ランダムなFloatingWindow設定を生成してドラッグ・リサイズ動作を検証
- 非バグ入力に対してマウスクリックや他の操作が多くのシナリオで継続動作することをテスト

### Integration Tests

- 各UIコンテキストでのi18n化されたテキスト表示の完全フローテスト
- FloatingWindowのドラッグ・リサイズ操作の完全フローテスト
- コンテキスト切り替え時のi18n化とFloatingWindow動作のテスト