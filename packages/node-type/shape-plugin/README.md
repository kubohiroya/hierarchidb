@hierarchidb/shape-plugin
=========================

Shape バッチ機能の新アーキテクチャ概要と利用メモ。

全体像（段階）
---------------
- download → simplify1 → simplify2 → vectorTiles の段階実行。
- 構成要素（feature への依存）
  - download: `@hierarchidb/download`（DownloadService, FetchNetworkPort, DexieChunkStoragePort）
  - auth: `@hierarchidb/auth-recovery`（401復帰, fetchWithAuth, setToken）
  - compute: `@hierarchidb/compute`（タスク実行）
  - batch: `@hierarchidb/batch`（段階並列・進捗）
  - source/view: `@hierarchidb/map-source`, `@hierarchidb/map-view`（任意）

ダウンロード
------------
- `DownloadWorker` は DownloadService を優先使用（Dexieへチャンク保存→ `readAll()` で解析）
- HTTP は `auth.fetchWithAuth()` 経由に統一（401時は UI 復帰後に自動再試行）

簡約処理
--------
- simplify1: Douglas–Peucker + 最小面積フィルタで `simplifiedBuffers(stage="simplify1")` に永続
- simplify2: ズーム別統計・準備（`simplifiedBuffers(stage="simplify2")`）
- vectorTiles: 必要最低限の MVT ダミー生成（テスト通過の最小実装）。本実装は今後段階的に置換可能。

認証連携（UI）
---------------
- UI 起動時に `registerAuthUIHandlers(prompt)` を登録（`@hierarchidb/ui-auth`）。
- サインイン/更新時は `setShapeAuthToken(token, 'Bearer', expiresAt)` を呼び、以後の HTTP に Authorization を付与。

進捗/通知
---------
- 各段階は `BatchSessionManager` から進捗イベントを発行（25/50/75/100%）。
- 401 発生時は `AuthRequired` 通知を UI に送出し、`AuthSuccess`/`AuthCancelled` で処理再開/中断。

今後の改善余地
--------------
- vectorTiles: 本実装（MVT エンコード/圧縮）とキャッシュ（CAS）
- simplify2: タイル境界クリップの導入
- map-source: R木/LOD で抽出高速化

