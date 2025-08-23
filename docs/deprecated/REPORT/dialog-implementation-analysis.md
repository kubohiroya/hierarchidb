# ダイアログ実装分析レポート

## 1. 仕様準拠状況

### 1.1 folderプラグイン
**準拠度: 50%**

#### 準拠している点
- ✅ 基本的なCreate/Editダイアログの分離
- ✅ nameとdescriptionフィールドの実装
- ✅ バリデーション機能
- ✅ MUI Dialogコンポーネントの使用

#### 仕様と異なる点
- ❌ Stepperによるマルチステップ未実装（単一画面のみ）
- ❌ ワーキングコピーパターン未実装
- ❌ Discard確認ダイアログ未実装
- ❌ ドラフト保存機能未実装
- ❌ 共通ダイアログタイトルコンポーネント未使用

### 1.2 basemapプラグイン
**準拠度: 30%**

#### 準拠している点
- ✅ Create/Edit mode対応
- ✅ 基本的なフォーム入力

#### 仕様と異なる点
- ❌ MUI Dialogではなく独自のdivベースの実装
- ❌ Stepperによるマルチステップ未実装
- ❌ ワーキングコピーパターン未実装
- ❌ Discard確認ダイアログ未実装
- ❌ ドラフト保存機能未実装
- ❌ Material UIコンポーネントをほぼ未使用

### 1.3 stylemapプラグイン
**準拠度: 80%**

#### 準拠している点
- ✅ MUI Stepperによる6ステップ実装
- ✅ MUI Dialogコンポーネントの使用
- ✅ 各ステップのバリデーション
- ✅ Next/Back/Saveボタンの実装
- ✅ フォームのバリデーション

#### 仕様と異なる点
- ❌ ワーキングコピーパターン未実装
- ❌ Discard確認ダイアログ未実装
- ❌ ドラフト保存機能未実装
- ❌ 共通ダイアログコンポーネントとの統合なし

## 2. コード重複分析

### 2.1 重複している機能

#### バリデーションロジック
各プラグインで同様のバリデーションを個別実装:
- 名前の必須チェック
- 文字数制限チェック
- エラー表示処理

#### ダイアログ基本構造
- Dialog開閉処理
- Submit/Cancel処理
- Loading状態管理
- エラー状態管理

#### フォーム状態管理
- useState による formData管理
- エラー状態の管理
- 入力変更ハンドリング

### 2.2 共通化可能なコンポーネント

1. **CommonPluginDialog** - 基本ダイアログラッパー
2. **CommonDialogTitle** - 統一されたタイトル部
3. **CommonDialogActions** - 統一されたアクション部
4. **UnsavedChangesDialog** - Discard確認ダイアログ
5. **StepperDialog** - マルチステップダイアログ基盤

## 3. コード共有化提案

### 3.1 共通コンポーネントパッケージ構造

```
packages/ui-dialog/
├── src/
│   ├── components/
│   │   ├── CommonPluginDialog.tsx      # 基本ダイアログラッパー
│   │   ├── CommonDialogTitle.tsx       # タイトル部
│   │   ├── CommonDialogActions.tsx     # アクション部
│   │   ├── UnsavedChangesDialog.tsx    # Discard確認
│   │   ├── StepperDialog.tsx           # マルチステップ基盤
│   │   └── DraftIndicator.tsx          # ドラフト状態表示
│   ├── hooks/
│   │   ├── useWorkingCopy.ts           # ワーキングコピー管理
│   │   ├── useDialogState.ts           # ダイアログ状態管理
│   │   ├── useFormValidation.ts        # バリデーション
│   │   └── useUnsavedChanges.ts        # 未保存変更検知
│   └── types/
│       └── dialog.ts                    # 共通型定義
```

### 3.2 実装優先度

#### Phase 1: 基盤整備（高優先度）
1. **CommonPluginDialog** コンポーネント作成
   - MUI Dialog のラッパー
   - 基本的な開閉処理
   - Loading/Error状態管理

2. **useWorkingCopy** フック作成
   - ワーキングコピー作成/更新/破棄
   - EphemeralDB との連携

3. **UnsavedChangesDialog** コンポーネント作成
   - 仕様書通りのDiscard確認実装

#### Phase 2: UI統一（中優先度）
4. **CommonDialogTitle** コンポーネント作成
   - アイコン表示
   - タイトル/説明の統一レイアウト

5. **CommonDialogActions** コンポーネント作成
   - Cancel/Back/Next/Save ボタンの統一
   - バリデーション連携

6. **StepperDialog** コンポーネント作成
   - MUI Stepper ベース
   - ステップ間のナビゲーション
   - バリデーション統合

#### Phase 3: 高度な機能（低優先度）
7. **ドラフト保存機能**
   - isDraft フラグ管理
   - "Save as Draft" ボタン追加

8. **useFormValidation** フック
   - 共通バリデーションルール
   - エラー表示の統一

### 3.3 移行計画

#### Step 1: ui-dialog パッケージ作成
```bash
# 新パッケージ作成
mkdir packages/ui-dialog
cd packages/ui-dialog
pnpm init

# 依存関係追加
pnpm add @mui/material @hierarchidb/core @hierarchidb/api
```

#### Step 2: 共通コンポーネント実装
shapes_obsolate にある CommonDialog 実装を参考に、改善版を作成

#### Step 3: 各プラグインの段階的移行
1. stylemapプラグイン（最も仕様に近い）から移行開始
2. folderプラグインを共通コンポーネント使用に更新
3. basemapプラグインの全面的な書き換え

### 3.4 期待される効果

#### コード削減
- 各プラグインで約40-60%のコード削減
- 重複コードの排除

#### 保守性向上
- ダイアログUIの一元管理
- バグ修正の一箇所対応
- 新機能追加の簡易化

#### ユーザー体験の統一
- 全プラグインで一貫したUI/UX
- 操作性の統一
- エラー処理の標準化

## 4. 推奨実装順序

1. **即座に実装すべき項目**
   - CommonPluginDialog 基本実装
   - useWorkingCopy フック
   - UnsavedChangesDialog

2. **次期スプリントで実装**
   - StepperDialog
   - CommonDialogTitle/Actions
   - folderプラグインの移行

3. **将来的な実装**
   - ドラフト機能
   - basemapプラグインの全面改修
   - 高度なバリデーション機能

## 5. 技術的推奨事項

### 5.1 TypeScript型定義
```typescript
interface PluginDialogProps<T> {
  mode: 'create' | 'edit';
  nodeId?: TreeNodeId;
  parentNodeId?: TreeNodeId;
  initialData?: T;
  onSubmit: (data: T) => Promise<void>;
  onCancel: () => void;
  open: boolean;
}

interface WorkingCopyState<T> {
  data: T;
  isDirty: boolean;
  isDraft?: boolean;
  version: number;
}
```

### 5.2 Context API活用
ダイアログ状態管理のためのContext提供:
```typescript
const DialogContext = React.createContext<{
  workingCopy: WorkingCopyState;
  updateWorkingCopy: (data: Partial<T>) => void;
  commitChanges: () => Promise<void>;
  discardChanges: () => void;
}>();
```

### 5.3 パフォーマンス考慮
- React.memo による不要な再レンダリング防止
- useMemo/useCallback の適切な使用
- 大規模データ処理時の仮想スクロール検討

## 6. まとめ

現状の実装は各プラグインで独自実装が多く、仕様書の要件を満たしていない部分が多い。特にワーキングコピーパターンとDiscard確認ダイアログは全プラグインで未実装。

共通コンポーネント化により、コードの重複を削減し、保守性を向上させることができる。shapes_obsolate に既存の実装があるため、これを改善して活用することで、効率的な移行が可能。

優先度としては、基盤となるCommonPluginDialogとワーキングコピー管理を最初に実装し、段階的に各プラグインを移行することを推奨する。