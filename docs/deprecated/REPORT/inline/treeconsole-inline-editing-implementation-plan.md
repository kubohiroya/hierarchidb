# TreeConsole インライン編集機能 実装計画

## 概要

TreeTableコンポーネントでのインライン編集機能を完成させるための実装計画です。現在、基本的なUI構造は存在するが、状態管理とWorking Copy連携が不完全な状態にあります。

## 現在の状況

### 実装済み
- 基本的なインライン編集UI（TextField表示/非表示）
- 編集開始/終了の基本的なイベントハンドリング
- コンテキストメニューからの編集開始

### 未実装・不完全
- orchestratorとコンポーネント間の編集状態同期
- Working Copy patternとの連携
- バリデーション機能
- キーボードナビゲーション
- エラーハンドリング

## 実装計画

### Phase 1: 基本機能の完成

#### 1. 編集状態管理の統合
**目的**: orchestratorとTreeTableCoreで編集状態を統一

**現在の問題**:
```typescript
// orchestrator/openstreetmap-type.ts
editingNodeId: null, // TODO: Add editing state

// TreeTableCore.tsx  
const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
```

**実装内容**:
- orchestratorで編集状態を一元管理
- TreeTableCoreは状態を参照のみ
- 状態変更はcontroller経由で実行

#### 2. Working Copy連携の実装
**目的**: 楽観的ロッキングとundo/redo対応

**実装内容**:
- 編集開始時: `createWorkingCopy(nodeId)`呼び出し
- 保存時: `commitWorkingCopy(nodeId)`でデータベース反映
- キャンセル時: `discardWorkingCopy(nodeId)`で変更破棄
- getCurrentNodeData()を使用したデータ整合性確保

#### 3. バリデーション機能の追加
**目的**: データ整合性とユーザーエクスペリエンス向上

**実装内容**:
- 同一親ノード内での名前重複チェック
- 空文字・特殊文字の入力制限
- リアルタイムバリデーション表示
- エラーメッセージの表示

### Phase 2: UX向上

#### 4. キーボードナビゲーションの実装
**目的**: パワーユーザー対応とアクセシビリティ向上

**実装内容**:
- **Tab**: 次行の編集に移動
- **Shift+Tab**: 前行の編集に移動  
- **Enter**: 保存して編集終了
- **Escape**: キャンセルして編集終了
- **F2**: 選択行の編集開始

#### 5. エラーハンドリングの強化
**目的**: プロダクション環境での信頼性確保

**実装内容**:
- ネットワークエラー時の再試行機能
- 保存失敗時のエラーメッセージ表示
- ロールバック機能の実装
- ユーザーフレンドリーなエラー表示

#### 6. 編集UI/UXの改善
**目的**: 視覚的フィードバックとアクセシビリティ対応

**実装内容**:
- 編集中の視覚的ハイライト
- スクリーンリーダー対応（ARIA属性）
- 保存/キャンセルのヒント表示
- ローディング状態の表示
- フォーカス管理の改善

### Phase 3: 高度機能

#### 7. 競合状態の処理
**目的**: マルチユーザー環境での安全性確保

**実装内容**:
- 同時編集検出機能
- 競合解決ダイアログ
- 最新データとの差分表示
- 自動マージ機能（可能な場合）

#### 8. 編集機能のテスト実装
**目的**: 品質保証とリグレッション防止

**実装内容**:
- 編集開始/終了のユニットテスト
- キーボード操作のE2Eテスト
- エラーケースのテストカバレッジ
- Working Copy連携のテスト

## 技術仕様

### 状態管理構造
```typescript
interface EditingState {
  editingNodeId: string | null;
  editingValue: string;
  originalValue: string;
  workingCopyId: string | null;
  validationErrors: string[];
  isLoading: boolean;
}
```

### Controller Interface拡張
```typescript
interface TreeTableController {
  // 編集機能
  startEdit: (nodeId: string) => Promise<void>;
  finishEdit: (nodeId: string, newValue: string) => Promise<boolean>;
  cancelEdit: () => void;
  
  // 編集状態
  editingState: EditingState;
  
  // バリデーション
  validateNodeName: (name: string, parentId: string) => Promise<ValidationResult>;
}
```

### Working Copy連携
```typescript
// 編集開始
const startEdit = async (nodeId: string) => {
  const currentData = await getCurrentNodeData(nodeId);
  const workingCopy = await createWorkingCopy(nodeId, currentData);
  
  setEditingState({
    editingNodeId: nodeId,
    editingValue: currentData.name,
    originalValue: currentData.name,
    workingCopyId: workingCopy.id,
    validationErrors: [],
    isLoading: false,
  });
};

// 編集完了
const finishEdit = async (nodeId: string, newValue: string) => {
  const validation = await validateNodeName(newValue, node.parentId);
  if (!validation.isValid) {
    setValidationErrors(validation.errors);
    return false;
  }
  
  await updateWorkingCopy(workingCopyId, { name: newValue });
  await commitWorkingCopy(workingCopyId);
  
  clearEditingState();
  return true;
};
```

## 実装順序

1. **編集状態管理の統合** (1-2日)
2. **Working Copy連携の実装** (2-3日)
3. **バリデーション機能の追加** (1-2日)
4. **キーボードナビゲーションの実装** (1-2日)
5. **エラーハンドリングの強化** (1-2日)
6. **編集UI/UXの改善** (2-3日)
7. **競合状態の処理** (2-3日)
8. **編集機能のテスト実装** (2-3日)

## 完成基準

### 機能要件
- [x] 基本的なインライン編集（クリック→編集→保存）
- [ ] Working Copy patternとの完全連携
- [ ] リアルタイムバリデーション
- [ ] 完全なキーボードナビゲーション
- [ ] 堅牢なエラーハンドリング

### 非機能要件
- [ ] レスポンス時間: 編集開始 < 200ms
- [ ] アクセシビリティ: WCAG 2.1 AA準拠
- [ ] テストカバレッジ: 90%以上
- [ ] 同時編集対応: 10ユーザーまで

## 関連ファイル

### 主要ファイル
- `packages/ui/treeconsole/treetable/src/components/TreeTableCore.tsx`
- `packages/ui/treeconsole/treetable/src/orchestrator/openstreetmap-type.ts` 
- `packages/ui/treeconsole/treetable/src/state/openstreetmap-type.ts`
- `packages/ui/treeconsole/base/src/adapters/commands/WorkingCopyCommands.ts`

### 関連インターフェース
- `packages/ui/treeconsole/treetable/src/types.ts`
- `packages/ui/treeconsole/base/src/hooks/useTreeViewController.tsx`

## 参考資料

- [Working Copy Pattern実装](../implements/working-copy/)
- [TreeConsole全体のアーキテクチャ](../architecture/)
- [ユーザビリティガイドライン](../design/usability-guidelines.md)