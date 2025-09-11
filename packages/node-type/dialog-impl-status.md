# Node-Type Dialog Step State/Navigation Implementation Status

本資料は、`packages/node-type/*-plugin` における「作成/編集ダイアログ」内の各ステップについて、
フォーム入力に応じた「入力済み（充足）判定」と「ステップを開ける（遷移できる）判定」がどのように実装されているかを調査した結果の一覧です。

## サマリー（一覧表）

| プラグイン（nodeType） | ダイアログ実装 | 入力済み判定（関数/実装） | ステップ遷移可否判定 | 主な実装箇所 |
| - | - | - | - | - |
| folder-plugin（ホスト） | ExtensibleFolderDialog（`@hierarchidb/ui-dialog` の MultiStepDialog を利用） | `DialogStepDefinition.validation.validate(data)`（base Step は `FolderStepValidation.validate`）が true/false を返し、UI 側でエラー表示 | 遷移制御は `MultiStepDialog` 側に委譲（旧実装では `dependsOn` を満たした完了済みステップのみ可） | `folder-plugin/src/components/ExtensibleFolderDialog.tsx`（validation 呼び出し）、`folder-plugin/src/base/BaseFolderPlugin.ts`（`createDialogStep`） |
| basemap-plugin（basemap） | folder の拡張ステップ | 各拡張ステップの `validation.validate(data)` | `MultiStepDialog` による順次遷移（`dependsOn` 記載なし） | `basemap-plugin/src/extension/definition.ts` |
| shape-plugin（shape） | folder の拡張ステップ | 各拡張ステップの `validation.validate(data)` | `dependsOn` により前段完了が必要（旧 `MultiStepDialog` では依存満了で遷移可） | `shape-plugin/src/extension/definition.ts` |
| spreadsheet-plugin（spreadsheet） | folder の拡張ステップ | Step2/Step3 に `validation.validate(data)`（Step2: 必須チェック、Step3: 常に true） | 順次遷移（`dependsOn` なし） | `spreadsheet-plugin/src/extension/definition.ts` |
| styler-plugin（styler, ext=spreadsheet） | spreadsheet の拡張ステップ（Step5/Step6 追加） | 各ステップの `validation.validate(data)`（Step5: 必須項目/範囲、Step6: 常に true） | 順次遷移（`dependsOn` なし） | `styler-plugin/src/extension/definition.ts`, `styler-plugin/src/components/steps/StylerStep5.tsx`, `StylerStep6.tsx` |
| styler-plugin（folder 拡張バリアント） | folder の拡張（サンプル実装） | `BaseFolderPlugin#createDialogStep` で渡す `validation.validate(data)` | `dependsOn` 相当の指定はコード上コメントアウトのため未配線／実質は順次遷移 | `styler-plugin/src/extensions/StylerFolderExtension.tsx`, `folder-plugin/src/base/BaseFolderPlugin.ts` |
| route-plugin（route） | 独自ダイアログ `RouteDialog` | 各子ステップが `onValidationChange(isValid: boolean)` を親に通知し、`stepValidation[]` を更新 | Next ボタンの活性/非活性で遷移制御（ステッパー直接遷移なし） | `route-plugin/src/components/RouteDialog.tsx` と各 Step（`RouteBasicInfoStep.tsx` ほか） |
| resolver-plugin（resolver） | 独自ダイアログ `ResolverDialog` | 各子ステップが `onValidationChange(isValid: boolean)` を親に通知し、`stepValidation{}` を更新 | Next で順次。ステッパークリックは「一度全完了した後」または「現在位置以前」へ限定 | `resolver-plugin/src/components/ResolverDialog.tsx` と各 Step |
| location-plugin（location） | 単票ダイアログ（現状）＋ハンドラにステップ能力判定 | `LocationEntityHandler#getStepCapabilities(data, step)` が `canProceedToNext` を返す（入力充足の近似） | 同関数が `canNavigateTo` を返す（ステップ解放判定）。UI 側のウィザード化は未整備 | `location-plugin/src/entities/LocationEntityHandler.ts`（`getStepCapabilities`） |
| project-plugin（project） | 独自ダイアログ `ProjectWizard` | 具体的なバリデーション連動無し（Next 常時有効・各 Step 内で onComplete を想定） | 順次遷移のみ（バリデーションによる制御なし） | `project-plugin/src/components/wizard/ProjectWizard.tsx` |

## 詳細メモ

### folder-plugin（ホスト: ExtensibleFolderDialog）
- 入力済み判定
  - Base ステップ（Step1）は `FolderStepValidation.validate(data)` が `ValidationResult` を返却。
  - 拡張ステップは `DialogStepDefinition.validation.validate(data)`（各プラグイン側で実装）。
  - 参照: `packages/node-type/folder-plugin/src/components/ExtensibleFolderDialog.tsx`（約 L206, L318 付近）、`packages/node-type/folder-plugin/src/base/BaseFolderPlugin.ts`（`createDialogStep`）。
- ステップ遷移判定
  - 実際の遷移可否（ステッパー移動/Next 活性）は `@hierarchidb/ui-dialog` の `MultiStepDialog` に委譲。
  - 旧版（`packages/runtime-ui/plugin-dialog/src_deprecated/*`）では `dependsOn` を満たし「完了済み」のステップのみ `helpers.canGoToStep` で開放する実装を確認。

### basemap-plugin
- 入力済み判定: `BaseMapExtension.extendedSteps[].validation.validate(data)` でスタイル/ビューポート等を検証。
- ステップ遷移判定: `dependsOn` 指定なしのため順次（`MultiStepDialog` 標準挙動）。
- 参照: `packages/node-type/basemap-plugin/src/extension/definition.ts`。

### shape-plugin
- 入力済み判定: 各拡張ステップで `validation.validate(data)`。
- ステップ遷移判定: `dependsOn`（例: Step3→[2], Step4→[3], Step5→[4]）を指定。旧 `MultiStepDialog` 実装では依存を満たした場合に遷移可。
- 参照: `packages/node-type/shape-plugin/src/extension/definition.ts`。

### spreadsheet-plugin
- 入力済み判定: Step2（データソース）/Step3（フィルタ）に `validation.validate(data)`（2 は必須、3 は常に true）。
- ステップ遷移判定: `dependsOn` なしで順次。
- 参照: `packages/node-type/spreadsheet-plugin/src/extension/definition.ts`。

### styler-plugin（spreadsheet の拡張）
- 入力済み判定: Step5/Step6 に `validation.validate(data)`（Step5 は対象プロパティ/値列/数値範囲、Step6 は true）。
- ステップ遷移判定: 順次。
- 参照: `packages/node-type/styler-plugin/src/extension/definition.ts`, `components/steps/StylerStep5.tsx`, `components/steps/StylerStep6.tsx`。

### styler-plugin（folder 拡張のサンプル）
- 入力済み判定: `BaseFolderPlugin#createDialogStep` で渡す `validation.validate(data)` を利用。
- ステップ遷移判定: コード上 `dependsOn` 相当はコメントアウトされており未配線。結果として順次遷移。
- 参照: `packages/node-type/styler-plugin/src/extensions/StylerFolderExtension.tsx`, `packages/node-type/folder-plugin/src/base/BaseFolderPlugin.ts`。

### route-plugin（独自ダイアログ）
- 入力済み判定: 各ステップコンポーネントが `onValidationChange(isValid)` を親へ通知し、親が `stepValidation[]` を保持。
- ステップ遷移判定: Next ボタンの活性で制御。ステッパー直接遷移は提供せず。
- 参照: `packages/node-type/route-plugin/src/components/RouteDialog.tsx` と `RouteBasicInfoStep.tsx` など。

### resolver-plugin（独自ダイアログ）
- 入力済み判定: 各ステップが `onValidationChange(isValid)` を親へ通知し、親が `stepValidation{}` を保持。
- ステップ遷移判定: Next で順次。ステッパークリックは「一度全手順を完了した後」または「現在ステップ以前」への移動のみ許可。
- 参照: `packages/node-type/resolver-plugin/src/components/ResolverDialog.tsx`。

### location-plugin
- 入力済み判定/ステップ遷移判定の両方を `LocationEntityHandler#getStepCapabilities(data, step)` が返却（`canProceedToNext`, `canNavigateTo` など）。
- UI は現状単票ダイアログで、このウィザード能力はハンドラ側で定義済み（未配線）。
- 参照: `packages/node-type/location-plugin/src/entities/LocationEntityHandler.ts`（`getStepCapabilities`）。

### project-plugin（独自ダイアログ）
- 入力済み判定: 明確なバリデーション連動は未実装（Next は常時有効）。
- ステップ遷移判定: 順次のみ（バリデーションによるブロックなし）。
- 参照: `packages/node-type/project-plugin/src/components/wizard/ProjectWizard.tsx`。

## 備考
- `@hierarchidb/ui-dialog` の現行 `MultiStepDialog` 実装は dist 参照のため詳細コードは未同梱。旧 `packages/runtime-ui/plugin-dialog/src_deprecated/*` にある `WizardProvider/StepWizardContext` では、
  - `validateStep` により `isValidated`/`errors` を更新 → Next 可否を決定、
  - `canGoToStep(step)` で `dependsOn` を完了済みか評価、
  という構造を確認。現行版も同等の責務分担である前提で記載しています。

---

更新（Evaluator/Submit 可否/命名の一般化）
- ステップ評価:
  - 追加 API: `evaluateSteps: { getFilledSteps(data), getNavigableSteps(data) }`
  - Host（ExtensibleFolderDialog）はレジストリの evaluator と `dependsOn` を合成。
- サブミット評価:
  - 追加 API: `canSubmit(data)`（プラグイン側）→ Host で AND 合成し `evaluateSubmit(data)` として UI に渡す。
- 汎用初期化関数:
  - 新: `initializeDefaultNodeDialogExtensions()`（推奨）
  - 旧: `initializeDefaultFolderExtensions()`（非推奨; 後方互換のため残置）
- 型/名前の一般化（段階導入）:
  - `StepArrayEvaluator` の別名として `NodeDialogStepEvaluator` を追加。
  - `FolderDialogExtension` の別名として `NodeDialogExtension` を追加。
  - `FolderExtensionRegistry` の別名として `NodeDialogExtensionRegistry` とそのインスタンス `nodeDialogExtensionRegistry` を追加。
