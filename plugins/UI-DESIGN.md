# UI ステッパーダイアログ設計（node-type/*-plugin）

この文書は、packages/plugins/*-plugin に含まれる「ノード種別ごとのステッパーダイアログ（ウィザード含む）」の各ステップ仕様を整理したものです。
各ステップについて、以下を記載します。
- ステップタイトル / ステップ番号
- 画面構成（主要コンポーネント）
- 入力項目と「validated」とみなす条件
- 本ステップ画面から「バッチ処理開始」ボタンの有無

注: コード参照はリポジトリ内の相対パスを示します。番号は実装の配列順（0-based ではなく 1,2,…の表示順）です。

---

### バッチ処理 進捗確認（Route）
- 表示位置: ダイアログではなくパネル内（`packages/plugins/route-plugin/src/components/RoutePanel.tsx`）。
- コンポーネント
  - 起動: `RouteBatchLaunchForm`（起動時に `lastJobId` をセット）。
  - 進捗: `ui/components/RouteBatchLiveProgress.tsx`（フェーズ＋%の軽量バー）。
  - 概要: `ui/components/RouteBatchSummary.tsx`（Completed/Total と結果件数、%バー）。
  - テーブル: `DataGridPreview`（sessionId から tableId 取得、進捗パネル下に配置）。
- 構成/表示内容
  - Progress: %バー＋フェーズ（`useRouteBatchProgress` の snapshot）。
  - Summary: 完了数/総数、結果件数。
- 配置ボタン
  - 現状この進捗領域内に操作ボタンは無し（Pause/Resume/Stop は未配線。`RouteBatchManager` には pause/resume API あり）。

---

### 現状分析と最小復旧プラン（Route）
- 現状
  - ダイアログは 3 ステップ構成で保存までの UI は実装済み。
  - バッチはパネル内で起動・進捗表示（LiveProgress/Summary/DataGridPreview）。
  - `RouteBatchManager` に pause/resume API（Dexie の `routeCursors` フラグ）あり。
- モック/未配線
  - LiveProgress は Emitter/Store 経由の簡易スナップショットのみ。個別タスクの一覧/操作は未提供。
  - pause/resume の UI 配線なし。
- 最小復旧プラン（0.5〜1日）
  - パネル「進捗」カードに Pause/Resume ボタン追加→ `RouteBatchManager.pauseRouteBatchSession/resumeRouteBatchSession` を呼ぶ。
  - Summary 取得周期を短周期ポーリング or Emitter からの購読に寄せる。
  - 失敗数・直近エラーを Summary に表示。
- テスト・検証
  - `getRouteBatchProgress` のユニットテストでフェーズ推定/進捗%を検証。
  - LiveProgress のレンダー（progress→bar 反映）スモークテスト。
- 既知リスク
  - ルーティングエンジン（searoute 等）のスロットリングが UI 期待とズレると進捗が跳ねやすい。

## shape-plugin（ShapeStepperDialog）
- 実装: `packages/plugins/shape-plugin/src/components/ShapeStepperDialog.tsx`
- ステップ構成コンポーネント:
  - Step1BasicInfo: `components/steps/Step1BasicInfo.tsx`
  - Step2DataSource: `components/steps/Step2DataSource.tsx`
  - Step3License: `components/steps/Step3License.tsx`
  - Step3Processing: `components/steps/Step3Processing.tsx`
  - Step4CountrySelection: `components/steps/Step4CountrySelection.tsx`

### Step 1: Basic Information（1）
- 画面構成
  - MUI `TextField` による Name / Description 入力。
- 入力と validated 条件
  - 必須: Name（非空）。
  - validated: `!!draft.name`。
- バッチ処理開始ボタン
  - なし。

### Step 2: Data Source（2）
- 画面構成
  - データソース一覧（`DATA_SOURCE_CONFIGS`）から選択（カード風 UI）。
- 入力と validated 条件
  - 必須: `dataSourceName` の選択。
  - validated: `!!draft.dataSourceName`。
- バッチ処理開始ボタン
  - なし。

### Step 3: License Agreement（3）
- 画面構成
  - 選択したデータソースのライセンス表示＋同意アクション。
- 入力と validated 条件
  - 必須: `licenseAgreement === true`。
  - validated: `draft.licenseAgreement === true`。
- バッチ処理開始ボタン
  - なし。

### Step 4: Processing Configuration（4）
- 画面構成
  - 処理オプション（並列度、簡略化等）。
- 入力と validated 条件
  - 条件: `validateProcessingConfig(draft.processingConfig)` が true。
  - validated: 上記検証の成功。
- バッチ処理開始ボタン
  - 表示: あり（このステップ以降でフッターに表示）。
  - 有効化条件（ShapeStepperDialog 内 `canStartBatch`）:
    - Name 非空
    - Data Source 選択済み
    - License 同意済み
    - Processing 設定が有効
    - Country Selection が1つ以上（次ステップで満たす）

### Step 5: Country Selection（5）
- 画面構成
  - 国×行政レベル選択マトリクス、統計表示、選択検証。
- 入力と validated 条件
  - 必須: 1 マス以上の選択。
  - validated: `hasSelectedCountries(draft)` が true。
- バッチ処理開始ボタン
  - 表示: あり（Step 4 と 5）。
  - 有効化条件: Step 4 記載の `canStartBatch` をすべて満たす。

---

### バッチ処理 進捗確認画面（Shape）
- コンポーネント: `packages/plugins/shape-plugin/src/components/BatchProcessingMonitorDialog.tsx`
- 構成
  - タイトル行:
    - 左: タイトル「Batch Processing Monitor」＋ `BatchStatusChip`（`preparing/downloading/processing/generating/completed/error`）＋ 全体進捗% 表示。
    - 右: `Stop All`（一括停止）, `Close`（実行中は無効化／確認ダイアログあり）。
  - タブ: `Progress` / `Map Preview` / `Error Report`（バッジで件数表示）。
  - Progress タブ:
    - `BatchProgressSplitView`: Allotment で4ペイン表示（Download / Feature Processing / Tile Extraction / Vector Tiles）。
    - 各ペイン: ステージ見出しカード（%チップ＋LinearProgress＋完了数/総数）→ 下に `TaskMonitor`（タスク単位で状態チップ、進行中は Pause、Paused は Resume、エラー表示、メタ情報）。
  - Map Preview タブ: ダウンロード／タイル生成状況を地図プレビュー（`MapPreview`）。
  - Error Report タブ: `ErrorReportPanel`（エラー一覧、クリア、ステージ別件数）。
- 配置ボタン
  - タイトル行: `Stop All`, `Close`。
  - Progress タブ（各タスク行）: `Pause` / `Resume`。
  - 補助ダイアログ: 実行中に閉じる操作→「Continue Monitoring / Close Anyway」の確認ダイアログ、`ErrorConsoleDialog`。

---

### 現状分析と最小復旧プラン（Shape）
- 現状
  - ステッパー/検証/開始条件は概ね実装済み。
  - バッチ監視は `useBatchWorkerConsole`（モック）に依存し、擬似エラー注入も含む。
  - `generateUrlMetadata` による URL メタ生成はモックデータ。
  - Map プレビューは簡易（タイル生成との同期待ちロジック未詰め）。
- モック/未配線
  - 実ワーカー/バックエンドへの Start/Pause/Resume/Stop の配線未実装。
  - タスク永続化（進捗/結果）の双方向同期は簡易。
  - ErrorConsole は UI ありだがソース（worker 由来）配線はモック。
- 最小復旧プラン（1〜2日）
  - Start/Pause/Resume/Stop をインターフェース化し DI（実装: モック/本番）を切替可能に。
  - 進捗イベント（download/extract*/vectortile）をストアに集約（メモリ or Dexie）し、UI はストア購読に一本化。
  - MapPreview は vectorTileTasks 完了時にのみ有効化、タイル URL/レイヤーを注入。
  - 監視ダイアログの Close 確認ダイアログを本番モードでも活かす。
- テスト・検証
  - ステップ検証関数のユニットテスト追加（Step1/3/4/5）。
  - 監視 UI のスナップショット＋擬似進捗イベント流し込みのレンダーテスト。
- 既知リスク
  - Allotment の React 19 型ズレ回避のワークアラウンドあり（将来置換方針検討）。

## route-plugin（RouteDialog）
- 実装: `packages/plugins/route-plugin/src/components/RouteDialog.tsx`
- ステップ構成コンポーネント:
  - RouteDetailsStep, RouteSelectionStep, RouteProcessingStep

### Step 1: Basic Information（1）
- 画面構成
  - Name / Description（`@hierarchidb/ui-core` の `BasicInfoFields`）。
  - Route Type 単一選択、Transport Modes 複数選択。
- 入力と validated 条件
  - 必須: Name 非空、Route Type 選択、Transport Modes 1件以上。
  - validated: 3 条件すべてを満たす。
- バッチ処理開始ボタン
  - なし。

### Step 2: Route Selection（2）
- 画面構成
  - 経由地（Start/End/中間）リスト、現在地取得、経路アルゴリズム選択等。
- 入力と validated 条件
  - 必須: Start/End の名称が非空（座標は任意）。
  - validated: Start/End 名称の両方が非空。
- バッチ処理開始ボタン
  - なし（本ダイアログは保存まで）。

### Step 3: Processing（3）
- 画面構成
  - カテゴリ選択、簡略化レベル、各種生成オプション、実行/停止 UI（シミュレート）。
- 入力と validated 条件
  - 本ステップの `validated` は処理実行成功時に true（シミュレーション）。
- バッチ処理開始ボタン
  - なし（保存で完了）。

---

## resolver-plugin（ResolverDialog）
- 実装: `packages/plugins/resolver-plugin/src/components/ResolverDialog.tsx`
- ステップ構成: 6 ステップ
  1) Basic Information
  2) Schema Selection
  3) Property Mapping
  4) Validation Rules
  5) Duplicate Resolution
  6) Preview & Test

### Step 1: Basic Information（1）
- 画面構成: `BasicInfoFields`（Name/Description）＋説明パネル。
- 入力と validated 条件
  - Name 必須（<=100）、Description は最大 500 文字。
  - validated: 両条件を満たす。
- バッチ処理開始ボタン: なし。

### Step 2: Schema Selection（2）
- 画面構成: ソース/ターゲットスキーマの入力・プレビュー、プロパティ一覧。
- 入力と validated 条件
  - 必須: SourceSchema/TargetSchema が正しく解析されること（構文・構造エラー無し）。
  - validated: 両スキーマが有効でエラー無し。
- バッチ処理開始ボタン: なし。

### Step 3: Property Mapping（3）
- 画面構成: テキストルール `source -> target | transform` 入力、候補サジェスト、プレビュー。
- 入力と validated 条件
  - 必須: 1 行以上のマッピング定義、構文エラー無し、（可能ならスキーマ整合）。
  - validated: ルールが存在し、エラー配列が空。
- バッチ処理開始ボタン: なし。

### Step 4: Validation Rules（4）
- 画面構成: ルール定義 UI（詳細はコンポーネント側、初期は常に valid）。
- 入力と validated 条件: 既定で `true`（任意）。
- バッチ処理開始ボタン: なし。

### Step 5: Duplicate Resolution（5）
- 画面構成: 戦略（ignore/overwrite/merge/skip/custom）選択。custom は関数エディタあり。
- 入力と validated 条件
  - custom 選択時: 関数コード必須・JS 構文が正しいこと。
  - その他戦略: 追加入力任意。
  - validated: 上記条件を満たす。
- バッチ処理開始ボタン: なし。

### Step 6: Preview & Test（6）
- 画面構成: サンプルデータに対する適用結果・統計・エラー/警告表示。実行は任意。
- 入力と validated 条件: 常に valid（プレビューは任意）。
- バッチ処理開始ボタン: なし。

---

## linker-plugin（ProjectWizard）
- 実装: `packages/plugins/linker-plugin/src/components/wizard/ProjectWizard.tsx`
- ステップ構成: 6 ステップ
  1) Basic Information
  2) Target Region
  3) Data Layers
  4) Spatial Analysis
  5) Temporal Analysis
  6) Output Settings
- 特徴: 各ステップコンポーネントが `onComplete` で次へ進む。明示的なバリデーションは最小限（UI ヒントはあるが、通過条件は緩め）。
- バッチ処理開始ボタン: なし（最終ステップで Create）。

---

## basemap-plugin（Folder拡張: extendedSteps）
- 実装: `packages/plugins/basemap-plugin/src/extension/definition.ts`
- ステップ: Folder ダイアログに拡張ステップを追加（stepNumber は 2〜4）
  - Step 2: Map Style
    - 入力: スタイル選択（custom の場合 URL 必須）。
    - validated: スタイル選択済み、custom 選択時は URL 妥当。
  - Step 3: Map Viewport
    - 入力: center (lng/lat), zoom 等。
    - validated: center が数値かつ経度[-180,180]・緯度[-90,90]、zoom は [0,24]。
  - Step 4: Display Options
    - 入力: 表示オプション各種。
    - validated: 常に true（任意）。
- バッチ処理開始ボタン: なし。

---

### 現状分析と最小復旧プラン（BaseMap）
- 現状
  - 拡張定義に Step2〜4 と詳細なバリデーション実装済み。
  - UI はパネル（`BaseMapPanel`）中心。`dialogComponentPath` が `BaseMapPanel` を指しており、ダイアログ本体は未整備の可能性。
- モック/未配線
  - ダイアログ（作成/編集）としてのコンポーネントが未分離。
- 最小復旧プラン（0.5日）
  - `BaseMapDialog` を `BaseMapPanel` から抽出（ヘッダ/アクション/フォーム化）し、`dialogComponentPath` を差し替え。
  - 既存検証ロジックをダイアログ保存時にも適用。
- テスト・検証
  - extension 既存テストを流用し、ダイアログの happy-path スモークテストを追加。

## spreadsheet-plugin（Folder拡張: extendedSteps）
- 実装: `packages/plugins/spreadsheet-plugin/src/extension/definition.ts`
- ステップ: Folder ダイアログに拡張ステップを追加（Step 2, Step 3）
  - Step 2: データソース選択
    - 入力: dataSource 必須。type が `file` の場合はファイル名 or `dataSource.source` 必須。
    - validated: 上記必須条件を満たす。
  - Step 3: フィルタリング
    - 入力: 行/列フィルタ（任意）。
    - validated: 常に true。
- バッチ処理開始ボタン: なし。

---

### 現状分析と最小復旧プラン（Spreadsheet）
- 現状
  - 拡張定義/テストは存在。Step2/Step3 の `component` は `null`（未実装）。
  - バリデーションは Step2=必須/拡張ルール（拡張子チェック）、Step3=任意。
- モック/未配線
  - UI コンポーネント未実装（tests は定義存在を前提）。
- 最小復旧プラン（0.5〜1日）
  - Step2: 簡易 `TabularDataSourceStep`（ファイル/URL/手動）を実装、`dataSource` を working copy に反映。
  - Step3: 簡易 `TabularDataFilterStep`（列選択/簡易条件）を実装（任意）。
  - `component` を設定して拡張定義に反映。
- テスト・検証
  - 既存の定義テストを更新（`component !== null` 前提に変更）。

## styler-plugin（Folder拡張: create/edit ダイアログへの追加ステップ）
- 実装: `packages/plugins/styler-plugin/src/extensions/StylerDialogExtension.tsx`
- ステップ: Folder ダイアログに 2 ステップを追加（`order` により相対配置。一般的には 5,6 相当）
  - Map Style（label: "Map Style"）
    - 画面構成: スタイル種別、データソース、カラースキーム、opacity、閾値等。
    - validated: スタイル種別を選んだ場合は dataSource 必須。min/max の大小関係が正しいこと。
  - Categories（label: "Categories"）
    - 画面構成: カテゴリ一覧編集（最大 50、重複禁止）。
    - validated: 50 超過なし、重複なし。
- バッチ処理開始ボタン: なし。

---

### 現状分析と最小復旧プラン（Styler）
- 現状
  - Folder 拡張の 2 ステップ（Map Style/Categories）と検証が実装済み。表プレビュー（Step6）関連コンポーネントも在庫。
- モック/未配線
  - スタイルの実適用/プレビューは最小限。カテゴリ > 50 の制約などは UI 検証のみに依存。
- 最小復旧プラン（0.5日）
  - Map スタイルのプレビュー用スタブを用意（例: `ui-map` のレイヤ設定反映）。
  - 変換保存の I/O 経路確認（FolderEntity の拡張フィールド `stylerConfig`）。
- テスト・検証
  - 既存インテグレーションに追従、カテゴリ重複/上限ユースケース追加。

## location-plugin（現状: 単一画面ダイアログ／将来のステップ設計）
- 実装（現状の作成・編集）: `packages/plugins/location-plugin/src/components/LocationDialog.tsx`（単一画面）
- 将来の多段化設計（仕様フック）: `LocationEntityHandler.getStepCapabilities()` に準拠（4 ステップ想定）
  1) 基本情報: Name / Type
  2) 位置情報: 座標 or 住所
  3) 詳細情報: カテゴリ/タグ/メタ等
  4) 検証と最終確認
- バッチ処理開始ボタン: 位置情報が満たされれば 2 以降で可（仕様上）。

---

### バッチ処理 進捗確認画面（Location）
- コンポーネント: `packages/plugins/location-plugin/src/components/batch/BatchProgressDialog.tsx`
- 構成
  - タイトル行: 左にタイトル、右にフェーズ Chip と `Close`。直下に全体進捗（現在タスク名、% 表示、LinearProgress、経過/残り時間）。
  - タブ: `進捗状況` / `ログ` / `マッププレビュー` / `データテーブル`。
  - 進捗状況タブ:
    - 上段: 統計カード（処理済み件数/総件数、スループット[件/秒・B/s]、エラー件数）。
    - 中段: 垂直 Stepper（ダウンロード→フィルタ→クラスタ→インデックス）。各ステージで%チップと進捗バー、処理件数、エラー表示。
    - 下段: アクティブタスク一覧（進行度バー、速度、ETA、状態 Chip）。
  - ログタブ: レベル（info/warning/error）別の時系列ログ。
  - マッププレビュー: プレースホルダ（将来実装）。
  - データテーブル: `DataGridPreview`（pluginId=location, tableId 解決）。
- 配置ボタン
  - DialogActions: `閉じる`。
  - 右下 SpeedDial: `一時停止/再開`, `キャンセル`, `ログエクスポート`。

---

### 現状分析と最小復旧プラン（Location）
- 現状
  - 作成/編集は単一ダイアログ（基本情報＋ソース選択＋同意）。
  - 将来の 4 ステップ仕様フック（`getStepCapabilities`）はロジック定義済み。
  - バッチ進捗ダイアログは UI あり（SpeedDial で制御）。
- モック/未配線
  - 多段ステッパーダイアログへの統合は未実装。
  - 進捗ダイアログの実データ/worker 接続は最小化。
- 最小復旧プラン（1日）
  - `runtime-base-dialog` の StepperDialog を用い、4 ステップ構成のダイアログへ移行（現行単一画面を Step1/3 に分割して再利用）。
  - バッチ起動→進捗ダイアログ表示の配線をユースケースに沿って整理（Dexie のセッション/テーブル解決を非同期化）。
- テスト・検証
  - `getStepCapabilities` のユニットテスト。
  - StepperDialog の遷移/バリデーションのレンダーテスト。

## 備考
- Folder 系ダイアログは拡張ステップ（extendedSteps / createDialogSteps）として他プラグインが差し込む構成です。実際の番号はホスト側の先頭ステップ数によって変動します（本書では実装が固定で提供している stepNumber/order を基準に表記）。
- 「バッチ処理開始」ボタンは `shape-plugin` のステッパーダイアログに実装されています（Step 4〜）。`route-plugin`/`resolver-plugin`/`linker-plugin` は当該ダイアログでは開始せず保存/完了で閉じます。
