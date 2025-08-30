# @hierarchidb/ui-floating-window

汎用的なフローティングウィンドウUIコンポーネント。ドラッグ&ドロップによる位置変更、リサイズ、最小化/最大化機能を提供します。

## 機能

### 基本機能
- **ドラッグ移動**: タイトルバーをドラッグしてウィンドウ位置を変更
- **リサイズ**: ウィンドウのボーダーをドラッグしてサイズを変更
- **最小化/復元**: 右上ボタンでウィンドウを最小化・復元
- **閉じる**: 右上の×ボタンでウィンドウを閉じる
- **状態永続化**: ウィンドウの位置・サイズ・状態の保存/復元

### 高度な機能
- **制約付きリサイズ**: 最小/最大サイズの指定
- **カスタムスタイリング**: MUIテーマとの統合
- **アクセシビリティ**: キーボード操作対応
- **レスポンシブ対応**: 画面サイズに応じた自動調整

## インストール

```bash
pnpm add @hierarchidb/ui-floating-window
```

## 基本的な使用方法

```tsx
import { FloatingWindow } from '@hierarchidb/ui-floating-window';
import type { WindowState } from '@hierarchidb/ui-floating-window';

function MyComponent() {
  const [windowState, setWindowState] = useState<WindowState>({
    position: { x: 100, y: 100 },
    size: { width: 400, height: 300 },
    isMinimized: false,
    isVisible: true,
  });

  const handleStateChange = (newState: WindowState) => {
    setWindowState(newState);
    // 必要に応じて永続化
    localStorage.setItem('myWindow', JSON.stringify(newState));
  };

  return (
    <FloatingWindow
      title="検索結果"
      initialState={windowState}
      onStateChange={handleStateChange}
      onClose={() => setWindowState({ ...windowState, isVisible: false })}
    >
      <div>ウィンドウの内容をここに配置</div>
    </FloatingWindow>
  );
}
```

## プロパティ

### FloatingWindowProps

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `title` | `string` | - | ウィンドウのタイトル（必須） |
| `children` | `React.ReactNode` | - | ウィンドウの内容（必須） |
| `initialState` | `Partial<WindowState>` | - | 初期状態の設定 |
| `onStateChange` | `(state: WindowState) => void` | - | 状態変更時のコールバック |
| `onClose` | `() => void` | - | 閉じるボタンクリック時のコールバック |
| `minWidth` | `number` | `200` | 最小幅（px） |
| `minHeight` | `number` | `100` | 最小高さ（px） |
| `maxWidth` | `number` | `window.innerWidth` | 最大幅（px） |
| `maxHeight` | `number` | `window.innerHeight` | 最大高さ（px） |
| `resizable` | `boolean` | `true` | リサイズ可能かどうか |
| `draggable` | `boolean` | `true` | ドラッグ可能かどうか |
| `className` | `string` | - | 追加のCSSクラス |

### WindowState

```typescript
interface WindowState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isVisible: boolean;
}
```

## カスタムフック

### useFloatingWindow

フローティングウィンドウの状態管理を簡単にするフック：

```tsx
import { useFloatingWindow } from '@hierarchidb/ui-floating-window';

function MyComponent() {
  const {
    windowState,
    handlers: { onStateChange, onClose, onMinimize, onRestore }
  } = useFloatingWindow({
    initialPosition: { x: 100, y: 100 },
    initialSize: { width: 400, height: 300 },
    persistKey: 'myWindow', // LocalStorageキー
  });

  return (
    <FloatingWindow
      title="My Window"
      initialState={windowState}
      onStateChange={onStateChange}
      onClose={onClose}
    >
      <button onClick={onMinimize}>最小化</button>
      <button onClick={onRestore}>復元</button>
    </FloatingWindow>
  );
}
```

### useDragging / useResizing

低レベルなドラッグ・リサイズ操作のフック：

```tsx
import { useDragging, useResizing } from '@hierarchidb/ui-floating-window';

// ドラッグ操作
const { isDragging, dragOffset, onMouseDown } = useDragging({
  onDragStart: () => console.log('drag start'),
  onDragEnd: (position) => console.log('drag end', position),
});

// リサイズ操作
const { isResizing, onMouseDown } = useResizing({
  onResizeStart: () => console.log('resize start'),
  onResizeEnd: (size) => console.log('resize end', size),
  minWidth: 200,
  minHeight: 100,
});
```

## スタイリング

MUIテーマシステムと統合されています：

```tsx
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    // フローティングウィンドウのスタイルカスタマイズ
    MuiPaper: {
      styleOverrides: {
        root: {
          '&.floating-window': {
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            borderRadius: 12,
          },
        },
      },
    },
  },
});

<ThemeProvider theme={theme}>
  <FloatingWindow title="Styled Window">
    Content
  </FloatingWindow>
</ThemeProvider>
```

## アーキテクチャ

### コンポーネント構成

```
FloatingWindow
├── TitleBar (ドラッグ可能、ボタン配置)
├── ResizeHandle (8方向のリサイズハンドル)
└── WindowContent (children表示エリア)
```

### 状態管理

- React内部状態とコールバック関数による外部状態同期
- デバウンスによる過度な状態更新の抑制
- ブラウザ境界を超えない位置制約

### パフォーマンス最適化

- `useMemo`によるスタイル計算のキャッシュ
- `useCallback`によるイベントハンドラーの最適化
- `RequestAnimationFrame`による滑らかなアニメーション

## 使用例

### 基本的な検索結果ウィンドウ

```tsx
function SearchResultWindow({ results, onResultSelect }) {
  return (
    <FloatingWindow
      title={`検索結果 (${results.length}件)`}
      initialState={{
        position: { x: 50, y: 50 },
        size: { width: 350, height: 400 },
        isMinimized: false,
        isVisible: true,
      }}
    >
      <List>
        {results.map(result => (
          <ListItem 
            key={result.id}
            onClick={() => onResultSelect(result)}
          >
            {result.name}
          </ListItem>
        ))}
      </List>
    </FloatingWindow>
  );
}
```

### 永続化対応ウィンドウ

```tsx
function PersistentWindow({ treeId }) {
  const handleStateChange = async (state) => {
    // IndexedDBに保存
    await windowStateService.save(treeId, state);
  };

  const loadInitialState = async () => {
    const saved = await windowStateService.load(treeId);
    return saved || defaultState;
  };

  return (
    <FloatingWindow
      title="永続化ウィンドウ"
      initialState={await loadInitialState()}
      onStateChange={handleStateChange}
    >
      <div>永続化される内容</div>
    </FloatingWindow>
  );
}
```

## ブラウザサポート

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 技術仕様

- React 18.3+
- TypeScript 5.6+
- MUI 6.1+
- モジュール形式: ESM/CommonJS

## 関連パッケージ

- `@hierarchidb/runtime-search-result-window` - 検索結果表示に特化したウィンドウ実装