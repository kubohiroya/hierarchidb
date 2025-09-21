# @hierarchidb/plugins-linker-plugin — Linker（リンカー）

Linker は、Projects ツリー（folder / linker / timeline）で、フォルダにより集約・コンパイル済みのリソースを「link（参照）」して実用的な地図表示に束ねる軽量プラグインです。解析・生成など重い処理は行わず、選択・集約・表示に特化します。

## 目的（What/Why）
- compiled 済みのタイル・ベクター・スタイルなどを“再計算せず”に束ね、すぐ使える地図として活用する。
- フォルダやタイムラインで管理された成果物を、運用視点の「ビュー」として組み合わせる。
- 生成処理（shape/route/location 等）と利用（linker）を分離し、UI を軽く保つ。

## 機能（Features）
- リソース選択（チェックボックス）と簡易プレビュー（MapLibre）
- Compiled Map 表示（中心/ズームなどヒントの適用）
- 表示状態の保存（表示モード、ダイアログ位置・サイズ）
- 軽量な Worker ストア（Dexie: `linker-entities-db`）で永続化

## 使い方（Usage）
1) 前提
   - ホストアプリで本プラグインを有効化（本リポジトリの `app/` では済）
   - UI/Worker の peer 依存（React/MUI/`@hierarchidb/ui-map` 等）はホスト側で提供

2) 新規作成（UI）
   - Projects ツリーで「新規 → Linker」を選択
   - Step 1: リソース選択（TrashBin 風テーブルで複数選択）＋右側で簡易マッププレビュー
   - Step 2: Compiled Map 表示（中心/ズームがあれば適用）→ 完了で保存

3) ホスト組み込み
   - 追加の Worker 登録は不要です（UI 側へのプラグイン登録のみ）。

4) データ保存先（内部）
   - DB: `linker-entities-db`
   - テーブル: `peerEntities (&nodeId, updatedAt)`
   - 保存: 表示モード、ダイアログ位置・サイズ 等（ノードごとの UI 状態）

5) 旧 project-plugin からの移行
   - 旧 nodeType `project` → 新 `linker`
   - 旧 Worker 実装は不要になりました（削除済み）。新規は `linker` で作成してください。
   - ※ 2025-09-16 時点で `project-plugin` は Deprecated 扱いです。`@hierarchidb/plugins-linker-plugin` を利用してください。
