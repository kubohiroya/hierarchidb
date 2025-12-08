# @hierarchidb/ui-floating-window

Floating window component with drag/resize/minimize and state persistence helpers.

## Directory layout
```
components/   FloatingWindow and subcomponents
hooks/        useFloatingWindow, useDragging, useResizing
types/        WindowState, prop types
index.ts      Public exports
```

## Key exports
- `FloatingWindow` — draggable/resizable window with title bar, minimize/restore/close, bounds clamping.
- Hooks: `useFloatingWindow` (state/persistence helper), `useDragging`, `useResizing`.
- Types: `WindowState`, `FloatingWindowProps`.

## Usage (minimal)
```tsx
import { FloatingWindow, useFloatingWindow } from '@hierarchidb/ui-floating-window';

const { windowState, handlers } = useFloatingWindow({ persistKey: 'myWindow' });
return (
  <FloatingWindow
    title="Search results"
    initialState={windowState}
    onStateChange={handlers.onStateChange}
    onClose={handlers.onClose}
  >
    ...
  </FloatingWindow>
);
```

## Notes
- Integrates with MUI theming; supply `minWidth/minHeight` etc. for constraints.
- Persist state via `persistKey` or handle `onStateChange` to store externally.

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
