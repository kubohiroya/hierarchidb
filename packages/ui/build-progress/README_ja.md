# @hierarchidb/ui-build-progress

最終更新: 2026-04-05

HierarchiDB のビルド進捗表示 UI コンポーネント。ステージ別進捗バー、タスク一覧、エラー表示を提供する。

## メニューのフォーカス

ビルド進捗メニューは、表示中のツールバーまたはステージボタンから開く。メニューを閉じた後はトリガーボタンへフォーカスを戻す必要があるため、このパッケージ内の `DialogSafeMenu` は `disableRestoreFocus={false}` を明示する。

## ライセンス

MIT
