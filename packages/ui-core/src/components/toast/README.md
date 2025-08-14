# Toast Notification System

柔軟にカスタマイズ可能で、非表示設定もサポートするトースト通知システムです。

## 基本的な使用方法

### 1. ToastProviderをアプリに追加

```tsx
import { ToastProvider } from '@/shared/components/toast/ToastProvider';

function App() {
  return (
    <ToastProvider maxToasts={5}>
      {/* アプリケーションコンテンツ */}
    </ToastProvider>
  );
}
```

### 2. useToastNotificationsフックを使用

```tsx
import { useToastNotifications } from '@/shared/components/toast/ToastProvider';

function MyComponent() {
  const { success, error, warning, info, custom } = useToastNotifications();

  return (
    <div>
      <button onClick={() => success('操作が成功しました！')}>
        成功メッセージ
      </button>
      
      <button onClick={() => error('エラーが発生しました')}>
        エラーメッセージ
      </button>
      
      <button onClick={() => warning('注意が必要です')}>
        警告メッセージ
      </button>
      
      <button onClick={() => info('情報をお伝えします')}>
        情報メッセージ
      </button>
    </div>
  );
}
```

## 高度なカスタマイズ例

### 非表示設定

```tsx
// トーストを非表示にする
const { custom } = useToastNotifications();

custom({
  enabled: false, // これでトーストは表示されません
  message: 'このメッセージは表示されません',
  severity: 'info'
});
```

### リッチコンテンツ

```tsx
// Reactコンポーネントをメッセージとして使用
const { custom } = useToastNotifications();

custom({
  message: (
    <div>
      <strong>重要な通知</strong>
      <br />
      <span style={{ color: '#666' }}>詳細情報はこちら</span>
    </div>
  ),
  severity: 'warning',
  duration: 0, // 自動消去しない
});
```

### カスタムアクション付き

```tsx
const { custom } = useToastNotifications();

custom({
  message: 'ファイルのアップロードが完了しました',
  severity: 'success',
  action: {
    label: 'プレビュー',
    onClick: () => {
      // プレビューページに移動
      navigate('/preview');
    },
    color: 'primary',
    variant: 'contained'
  },
  duration: 8000, // 8秒後に自動消去
});
```

### カスタムスタイリング

```tsx
const { custom } = useToastNotifications();

custom({
  message: 'カスタムスタイルのトースト',
  severity: 'info',
  style: {
    backgroundColor: '#2196f3',
    color: 'white',
    borderRadius: 12,
    elevation: 8
  },
  position: {
    vertical: 'top',
    horizontal: 'center'
  }
});
```

### 永続的なトースト（手動で閉じるまで表示）

```tsx
const { custom } = useToastNotifications();

custom({
  message: 'この通知は手動で閉じるまで表示されます',
  severity: 'error',
  duration: null, // 自動消去しない
  closable: {
    enabled: true,
    label: '重要な通知を閉じる' // アクセシビリティ用
  }
});
```

### 進行状況と更新可能なトースト

```tsx
const { showToast, updateToast } = useToast();

// 初期トーストを表示
const toastId = showToast({
  id: 'upload-progress',
  message: 'アップロード中... 0%',
  severity: 'info',
  duration: null,
  closable: { enabled: false }
});

// 進行状況を更新
updateToast(toastId, {
  message: 'アップロード中... 50%'
});

// 完了時に更新
setTimeout(() => {
  updateToast(toastId, {
    message: 'アップロード完了！',
    severity: 'success',
    duration: 3000,
    closable: { enabled: true }
  });
}, 5000);
```

## LinkButtonとの統合

```tsx
import { LinkButton } from '@/components/ui/LinkButton/LinkButton';
import { useToastNotifications } from '@/shared/components/toast/ToastProvider';

function MyForm() {
  const { success, error } = useToastNotifications();

  return (
    <LinkButton
      to="/next-page"
      onSave={async () => {
        // データ保存処理
        await saveData();
      }}
      // 成功時のトースト（カスタマイズ可能）
      successToast={{
        message: (
          <div>
            <strong>保存完了</strong>
            <br />
            データが正常に保存されました
          </div>
        ),
        severity: 'success',
        duration: 5000,
        action: {
          label: '元に戻す',
          onClick: () => undoSave(),
          color: 'inherit'
        }
      }}
      // エラー時のトースト
      errorToast={{
        message: '保存中にエラーが発生しました',
        severity: 'error',
        duration: 8000,
        closable: { enabled: true }
      }}
      // トースト表示を完全に無効化する場合
      successToast={{
        enabled: false, // これで成功トーストは表示されません
        message: ''
      }}
      onToast={(config) => {
        // カスタムトースト処理
        if (config.severity === 'success') {
          success(config.message, config);
        } else if (config.severity === 'error') {
          error(config.message, config);
        }
      }}
    >
      保存して次へ
    </LinkButton>
  );
}
```

## 設定オプション

### ToastProvider Props

| プロパティ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----|
| `maxToasts` | `number` | `3` | 同時に表示する最大トースト数 |
| `defaultConfig` | `Partial<ToastConfig>` | `{}` | 全トーストのデフォルト設定 |

### ToastConfig Options

| プロパティ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----|
| `enabled` | `boolean` | `true` | トーストの表示/非表示 |
| `message` | `ReactNode` | - | 表示するメッセージ（React要素も可） |
| `severity` | `'success' \| 'error' \| 'warning' \| 'info'` | `'info'` | トーストの種類 |
| `duration` | `number \| null` | `4000` | 自動消去までの時間（ミリ秒）、`null`で無効 |
| `action` | `ActionConfig` | - | カスタムアクションボタン |
| `closable` | `ClosableConfig` | `{ enabled: true }` | 閉じるボタンの設定 |
| `position` | `PositionConfig` | `{ vertical: 'bottom', horizontal: 'left' }` | 表示位置 |
| `style` | `StyleConfig` | - | カスタムスタイル |
| `onClose` | `() => void` | - | 閉じる時のコールバック |
| `onOpen` | `() => void` | - | 開く時のコールバック |

## アクセシビリティ

- スクリーンリーダー対応済み
- キーボードナビゲーション対応
- 適切なARIAラベル設定
- 高コントラスト対応

## パフォーマンス

- 仮想化による大量トースト対応
- メモ化による不要な再レンダリング防止
- 軽量な実装でバンドルサイズ最小化