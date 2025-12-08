# Toast components

Toast provider and hooks for app-wide notifications with severity, actions, and updates.

## Directory layout
```
ToastProvider.tsx          Context provider
useToastNotifications.ts   Convenience hook (success/error/warning/info/custom)
useToast.ts                Low-level showToast/updateToast helpers
index.ts                   Public exports
```

## Key exports
- `ToastProvider` — wrap the app; props like `maxToasts`.
- Hooks: `useToastNotifications` (quick helpers), `useToast` (manual show/update/close).
- Toast options: message (string/ReactNode), severity, duration, action button, position, closable, enabled flag.

## Usage (minimal)
```tsx
import { ToastProvider, useToastNotifications } from '@hierarchidb/ui-core/toast';

function App() {
  return (
    <ToastProvider maxToasts={5}>
      <MyPage />
    </ToastProvider>
  );
}

function MyPage() {
  const { success, error } = useToastNotifications();
  return (
    <button onClick={() => success('Saved!')}>Save</button>
  );
}
```

## Notes
- Supports persistent toasts (duration=null) and later updates via `useToast().updateToast(id, ...)`.
- Position/severity/styles are customizable; toast rendering is MUI-based.
