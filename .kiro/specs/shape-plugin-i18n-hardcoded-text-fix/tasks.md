# 実装計画

- [x] 1. バグ条件探索テストの作成
  - **Property 1: Fault Condition** - i18n化とFloatingWindow状態管理のバグ
  - **重要**: 修正実装前にこのプロパティベーステストを作成する
  - **目標**: バグが存在することを実証する反例を表面化する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにプロパティをスコープする
  - geometry-likeステージのタスクでハードコーディングされた日本語テキストが表示されることをテスト（設計のFault Conditionより）
  - SourceステージのFloatingWindowでドラッグ・リサイズ操作が元に戻ることをテスト（設計のFault Conditionより）
  - 修正前のコードでテストを実行
  - **期待される結果**: テストが失敗する（これは正しい - バグが存在することを証明）
  - 反例を文書化して根本原因を理解する
  - テストが作成され、実行され、失敗が文書化されたらタスクを完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 保持プロパティテストの作成（修正実装前）
  - **Property 2: Preservation** - 非バグ条件での既存動作の保持
  - **重要**: 観察優先方法論に従う
  - 修正前のコードで非バグ入力の動作を観察する
  - 設計のPreservation Requirementsからの観察された動作パターンをキャプチャするプロパティベーステストを作成
  - プロパティベーステストはより強力な保証のために多くのテストケースを生成する
  - 修正前のコードでテストを実行
  - **期待される結果**: テストが成功する（これはベースライン動作を確認）
  - 修正前のコードでテストが成功したらタスクを完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Shape Plugin i18n化とFloatingWindow修正

  - [x] 3.1 TaskItemCard.tsxのi18n化実装
    - plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemCard.tsx の144-145行目を修正
    - ハードコーディングされた日本語テキストをtranslate関数呼び出しに置換
    - '失敗' → translate('task.status.failed', 'Failed')
    - '完了' → translate('task.status.completed', 'Completed')  
    - '試行' → translate('task.status.attempt', 'Attempt')
    - _Bug_Condition: isBugCondition(input) where input.component === 'TaskItemCard' AND input.stageType === 'geometry-like' AND input.taskStatus IN ['completed', 'failed']_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 1.1, 2.1_

  - [x] 3.2 taskOutcomeSummaryBuilders.tsのi18n化実装
    - plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders.ts のbuildGeometryTaskOutcomeSummary関数を修正
    - スキップ状態のi18n化（335-336行目）
    - 完了・失敗状態のi18n化（341-357行目）
    - 全てのハードコーディングされた日本語テキストをtranslate関数呼び出しに置換
    - _Bug_Condition: isBugCondition(input) where input.component === 'buildGeometryTaskOutcomeSummary'_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 1.2, 1.3, 2.2, 2.3_

  - [x] 3.3 TaskItemDetailWindow.tsxのFloatingWindow状態管理修正
    - plugins/shape-plugin/src/ui/components/build-progress/TaskItemCard/TaskItemDetailWindow.tsx を修正
    - useFloatingWindowフックの使用方法を修正
    - initialWindowStateの設定ロジックを見直し、不要な状態リセットを防ぐ
    - onStateChangeハンドラーの処理順序を調整
    - windowStateの更新タイミングを最適化
    - persistKeyの設定を見直し、Sourceステージ固有の状態管理を実装
    - _Bug_Condition: isBugCondition(input) where input.component === 'FloatingWindow' AND input.stage === 'source' AND input.operation IN ['drag', 'resize']_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 1.4, 1.5, 2.4, 2.5_

  - [x] 3.4 バグ条件探索テストが成功することを確認
    - **Property 1: Expected Behavior** - i18n化とFloatingWindow状態管理のバグ修正
    - **重要**: タスク1と同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すると、期待される動作が満たされていることを確認
    - ステップ1からのバグ条件探索テストを実行
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.5 保持テストが引き続き成功することを確認
    - **Property 2: Preservation** - 非バグ条件での既存動作の保持
    - **重要**: タスク2と同じテストを再実行する - 新しいテストを作成しない
    - ステップ2からの保持プロパティテストを実行
    - **期待される結果**: テストが成功する（リグレッションがないことを確認）
    - 修正後も全てのテストが成功することを確認（リグレッションなし）

- [x] 4. チェックポイント - 全てのテストが成功することを確認
  - 全てのテストが成功することを確認し、質問があれば用户に尋ねる