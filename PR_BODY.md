PR: ui-map を MapLibre ラッパ化し、basemap-plugin の shim/any/skipLibCheck を撤廃

要点
- `@hierarchidb/ui-map` を MapLibre 用の薄いラッパとして再設計。
- MapLibre の型変動は `ui-map` に閉じ込め、`skipLibCheck: true` も `ui-map` のみで適用。
- basemap-plugin の `maplibre-gl` shim と `any` 依存を削除。以降は `ui-map` の安定化型を参照。
- app の map 画面は `ui-map` の型を使用し、`maplibre-gl` の暫定 shim を削除。

ブランチ: `refactor/ui-map/maplibre-wrapper-clean`
対応タスク: TASKS.md > Doing > refactor/ui-map/maplibre-wrapper

変更詳細
- ui-map
  - 追加: `src/types/maplibre-public.ts`（安定化型 `MapLibreMapInstance/Style/Layer/Filter`）。
  - 変更: `unified-map-props.ts`（`mapStyle: string | MapLibreStyle` を許容、Filter を内製型へ差し替え）。
  - 変更: `MapLibreMap.tsx`/`MapWithVectorTiles.tsx`/`VectorTileLayer.tsx` を安定化型で統一。
  - 追加: `MapWithDeckGL` — Deck.gl の `MapboxOverlay` を安全に統合する薄いラッパ（peer: `@deck.gl/mapbox`）。
- basemap-plugin
  - 削除: `src/types/maplibre-gl-shim.d.ts` と tsconfig の paths 上書き。
  - 置換: レイヤ/スタイル周辺の `any` を安定化型参照に変更。
- app
  - 変更: `routes/map.tsx` を `ui-map` の型へ統一、`shims.d.ts` の maplibre 宣言を削除。
- docs
  - 変更: `TASKS.md` に方針/DoD/ロールバック/運用ログを追記。

受け入れ基準（ローカル確認）
- `pnpm --filter @hierarchidb/ui-map typecheck` OK。
- `pnpm --filter @hierarchidb/basemap-plugin typecheck` OK。
- `skipLibCheck: true` は `packages/ui/map/tsconfig.json` のみ。
- basemap-plugin に shim を残さず、`any` の恒常化を撤廃（対象箇所）。

ロールバック
- `ui-map` に閉じ込めているため、当該ブランチ差分のリバートのみで切戻し可能。repo 全体の `skipLibCheck` を有効化する必要はない。

フォローアップ
- app 側の maplibre 以外の型エラー（ui-usermenu 等）は別タスクで整理。
- basemap 以外のプラグインで maplibre を直接参照していないかの再確認（`rg` ベースで未検出、shape は `ui-map` 参照済み）。
- Deck.gl 連携は ui-map の `MapWithDeckGL` を標準経由に（他プラグイン移行時も同方針）。
