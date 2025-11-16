# Viewport Wheel/Pitch Investigation Log

| Attempt | MapLibre global change | Step3 container change | Result |
|---------|-----------------------|------------------------|--------|
| #1 (baseline) | なし | なし | `/map` : ✅ / Step3 : ❌ （ダイアログのスクロール優先） |
| #2 | `MapLibreMap` に `onWheelCapture` を追加して `preventDefault` | なし | `/map` : ⚠️ passive イベント警告、Step3 : ❌ |
| #3 | なし | Step3 コンテナで `onWheel`/`onWheelCapture` を追加し `preventDefault` | `/map` : 影響なし、Step3 : ❌（MapLibre へ届かず） |
| #4 (current) | なし（MapLibre はデフォルト） | Step3 コンテナはイベントを素通し + `touchAction: 'none'` のみ | `/map`: ✅ / Step3: 未解消 |

> メモ: 今後は `preventDefault` を行うフックを新しく追加しない。解決策を試す際は上記以外の方法（CSS の `touch-action` や Dialog 側のスクロール設定など）を検討すること。
| #5 | なし | Step3 コンテナに `onWheelCapture` (stopPropagation のみ) + `touchAction: none` | `/map`: ✅ / Step3: ❌ （MapLibre へ届かず） |
| #6 (current) | なし | Step3 の MapLibre コンテナ（`map.getContainer()`）へ `wheel` / `touchmove` リスナーを直接登録し、`passive:false` で `preventDefault` + `stopPropagation` を実施 | `/map`: ✅ / Step3: ✅（MapLibre 側でのズーム処理後にダイアログスクロールを抑止する理論実装。要UI確認） |
