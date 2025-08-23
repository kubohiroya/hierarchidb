# ダイアログシステム仕様

## はじめに

この章では、HierarchiDBのダイアログシステムの設計と実装について詳細に説明します。本章は以下のような方を対象としています：

**読むべき人**: UIコンポーネント開発者、プラグイン開発者、フロントエンド実装者、UX設計に関わる方、ダイアログやフォーム設計を担当する方

**前提知識**: React、Material-UI（MUI）、TypeScript、フォーム管理ライブラリ（React Hook Form等）、ワーキングコピーパターンの基本理解

**読むタイミング**: BaseMap、StyleMap、Shape、Spreadsheet、Projectプラグインなどの新規作成・編集ダイアログを実装する前、または既存ダイアログの改修を行う際に参照してください。特にステップ式ダイアログやドラフト保存機能の実装時には必須の資料です。

ダイアログシステムは、ユーザーがデータを作成・編集する際の主要なインターフェースであり、一貫性のあるUXを提供するための重要なコンポーネントです。本章で説明するワーキングコピーとの連携により、安全で直感的な編集体験を実現しています。

## 概要

HierarchiDBのダイアログシステムは、オブジェクトのCRUD操作のうち、Create/Updateを行うためのモーダルUIを提供します。各プラグインが独自のダイアログを定義でき、統一されたUXを維持しながら柔軟なカスタマイズが可能です。

## エンティティシステムとの関係

### オブジェクトの構成
オブジェクトは次の2種類の組み合わせで定義されます：

1. **ツリーノード**
   - ツリーの階層構造を表現する基本単位
   - 一意の識別子（ID）を持つ
   - 親ノードのIDを参照して階層構造を形成
   - name、description、treeNodeType、createdAt、updatedAt等の基本情報を管理

2. **エンティティ**
   - ツリーノードに紐づけられた情報
   - 2×3の分類（Persistent/Ephemeral × Peer/Group/Relation）
   - ノードのライフサイクルに応じて管理される

## ワーキングコピーシステム

### 基本動作

オブジェクトの編集が開始されると、「ワーキングコピー」が作成されます：

- **保存場所**: EphemeralDB（CoreDBとは別のデータベース）
- **ID管理**: オリジナルのツリーノードと同じIDを使用
- **数の制約**: オリジナルに対して0個または1個
- **エンティティ**: コピーオンライト方式で必要に応じて作成

### 編集フロー

1. **作成/編集開始**
   - 新規作成: デフォルト値でワーキングコピー作成
   - 編集: オリジナルからワーキングコピー作成
   - treeNodeIdプロパティに適切なIDをセット

2. **編集中**
   - URLに含まれるノードIDで編集対象を特定
   - 画面遷移ごとに自動保存
   - ダイレクトリンクで編集再開可能

3. **編集完了/中断**
   - 完了: ワーキングコピーをオリジナルに反映し破棄
   - 中断: ワーキングコピーを破棄（ドラフト保存可能な場合あり）

## ドラフト機能

### ドラフト状態の管理

編集作業を中断する際に、未完成状態を「ドラフト状態」として保存できます：

- **定義**: TreeNodeのisDraftプロパティがtrue
- **保存可否**: ツリーノードの種類による
- **制限**: ドラフト状態のオブジェクトは通常利用に制限あり
- **UI表示**: Discard確認ダイアログで「Save as Draft」ボタン表示

### ドラフト保存フロー

1. 編集中断時にDiscard確認ダイアログ表示
2. 「Save as Draft」選択
3. ワーキングコピーをオリジナルに反映（isDraft=true）
4. 後で編集再開可能

## ダイアログの種類

### プラグインダイアログ
ツリーノードの種類ごとの新規作成/編集用ダイアログ

**プロパティ:**
- モード: create（新規作成）/ edit（編集）
- ステップ数: 任意（1ステップ以上）
- 最大幅: lg（large）
- アイコン: Material Icon

### Discard確認ダイアログ
編集内容の破棄を確認するダイアログ

**表示条件:**
- 編集内容がある状態でCancelまたはbackdrop領域クリック

**UI構成:**
- タイトル: "Discard [NodeType] Configuration?"
- メッセージ: "You have unsaved changes. Are you sure you want to discard?"
- ボタン:
  - Cancel: ダイアログを閉じて編集継続
  - Discard: 編集内容を破棄
  - Save as Draft: ドラフトとして保存（対応時のみ）

### システムダイアログ
- ログイン時の認証プロバイダー選択
- ログアウト確認

## ダイアログレイアウト

### ヘッダー部
**MUI Stepper（マルチステップ時）:**
- 各ステップのタイトルと進捗状況
- 条件を満たす場合の他ステップへの直接ジャンプ
- クリックによるステップ間移動

### コンテント部
各ステップに応じた入力フォームや情報表示：
- Step 1: 基本情報（Name、Description）
- Step 2以降: プラグイン固有の設定

**UI要素:**
- スクロール可能領域
- アコーディオン/タブ
- 必須項目の明示
- リアルタイムバリデーション
- スナックバー通知

### フッター部
**左下ボタン:**
- Step 1: Cancelボタン
- Step 2以降: Backボタン

**右下ボタン:**
- 最終ステップ以外: Nextボタン
- 最終ステップ: Saveボタン
- バリデーション成功時のみ有効化

## 実装例

### ダイアログコンポーネント
```typescript
interface PluginDialogProps {
  mode: 'create' | 'edit';
  nodeId?: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

const PluginDialog: React.FC<PluginDialogProps> = ({
  mode,
  nodeId,
  onClose,
  onSave
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<WorkingCopy>();
  const [isDirty, setIsDirty] = useState(false);

  // ワーキングコピーの管理
  useEffect(() => {
    if (mode === 'edit' && nodeId) {
      loadWorkingCopy(nodeId);
    } else {
      createWorkingCopy();
    }
  }, [mode, nodeId]);

  // 自動保存
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        saveWorkingCopy(formData);
        setIsDirty(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [formData, isDirty]);

  return (
    <Dialog open maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stepper activeStep={activeStep}>
          {/* ステップ表示 */}
        </Stepper>
      </DialogTitle>
      
      <DialogContent>
        {/* 各ステップのコンテンツ */}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleBack}>
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={handleNext} disabled={!isValid}>
          {isLastStep ? 'Save' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### Discard確認ダイアログ
```typescript
const DiscardConfirmDialog: React.FC<{
  open: boolean;
  nodeType: string;
  canSaveAsDraft: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAsDraft?: () => void;
}> = ({ open, nodeType, canSaveAsDraft, onCancel, onDiscard, onSaveAsDraft }) => {
  return (
    <Dialog open={open}>
      <DialogTitle>
        Discard {nodeType} Configuration?
      </DialogTitle>
      <DialogContent>
        You have unsaved changes. Are you sure you want to discard?
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        {canSaveAsDraft && onSaveAsDraft && (
          <Button onClick={onSaveAsDraft}>Save as Draft</Button>
        )}
        <Button onClick={onDiscard} color="error">Discard</Button>
      </DialogActions>
    </Dialog>
  );
};
```

## バリデーション

### クライアントサイド検証
- 必須項目チェック
- 型チェック
- 範囲チェック
- 正規表現パターン
- カスタムバリデーション

### サーバーサイド検証
- 一意性チェック
- 参照整合性
- ビジネスルール

## エラーハンドリング

### エラー表示
- フィールドレベル: ヘルパーテキスト
- フォームレベル: アラート
- システムレベル: スナックバー/ダイアログ

### リカバリー
- 自動保存からの復元
- ドラフトからの再開
- エラー時のロールバック

## アクセシビリティ

### キーボード操作
- Tab: フォーカス移動
- Enter: デフォルトアクション
- Escape: キャンセル
- 矢印キー: ステップ移動

### スクリーンリーダー対応
- ARIAラベル
- ロール属性
- ライブリージョン

## 次のステップ

- [ワーキングコピー詳細](./03-core-workingcopy.md)
- [プラグインダイアログ開発](./04-plugin-overview.md)
- [UIコンポーネント](./05-dev-guidelines.md)