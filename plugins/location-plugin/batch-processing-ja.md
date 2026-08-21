## ビルド処理概要

LocationDialog における Start Build は以下の段階で構成する。

### 1. データ取得フェーズ
- ユーザーが指定したデータソース設定（CSV / GeoJSON / 外部 API など）をもとに、ダウンロードまたは API アクセスを実行し raw データを取得する。
- 取得したデータはビルドセッション開始前に検証（ファイル形式・エンコーディング・ヘッダー構造など）し、問題があれば即座にフィードバックする。

### 2. パース & LocationPoint 化
- raw データを行単位またはレコード単位で解析し、アプリで永続的に利用する `LocationPoint` 型へ整形する。
- `LocationPoint` は以下のフィールドを持ち、ベクトルタイルの各 Point フィーチャーの同名プロパティと値を完全に一致させる。
  - `pid`（点 ID）
  - `name`
  - `latitude` / `longitude`
  - `type`（点の種類: POI / 拠点 / etc.）
  - `countryCode`（国コード）, `admin1`（行政レベル 1）, `admin2`（行政レベル 2）
  - `metadata`（種別ごとの拡張情報。`Record<string, string | number | null>` として保持）
- 変換時に必須フィールドが欠落しているレコードは検出し、ログ・リトライ・スキップなどを一元管理する。

#### LocationPoint 型案
```ts
import type { GroupEntity } from '@hierarchidb/common-type';

type LocationPoint = GroupEntity<string> & {
  schemaVersion: 2;
  nodeId: NodeId;
  type: 'locationPoint';
  /** ベクトルタイルの Point フィーチャーと一致する一意 ID */
  pid: string;
  /** 表示名 */
  name: string;
  /** 緯度・経度（WGS84） */
  latitude: number;
  longitude: number;
  /** 点の種類（例: poi / facility / station など） */
  type: string;
  /** 行政区分。countryCode: 国, admin1: 都道府県相当, admin2: 市区町村相当 */
  countryCode: string;
  admin1?: string;
  admin2?: string;
  /** ベクトルタイルにも埋め込む追加属性（カテゴリや tags 等） */
  metadata?: Record<string, string | number | null>;
  /** データソースメタ（取得元 URL / 変換ルール ID 等） */
  source?: {
    provider: string;
    fetchedAt: number;
    originalId?: string;
  };
};
```

各データソース向けのパーサは、地点としての用途に直結しない情報を `metadata` に集約する。`metadata` は `Record<string, string | number | null>` として統一し、同名キーが存在する場合は後続のパーサで上書きしない運用を前提とする。

### 3. 永続化フェーズ（Persistent DB）
- 完成した `LocationPoint` を永続ストア（`LocationDB.features`）へ保存する。既存エンティティと重複する場合はアップサートポリシーを定義する。
- ビルドセッションのメタデータ（設定値・取得元・処理数・最終更新時刻など）の永続化は将来のセッション管理テーブル導入時に対応する。

### 4. ベクトルタイル生成フェーズ（将来案）
- 永続化した `LocationPoint` 群をもとに、ズーム範囲ごとのベクトルタイルを生成する。
- 生成されたタイルは将来導入予定の `vectorTiles` テーブルやオブジェクトストレージに保存する。

### 5. 進捗監視と通知
- `LocationBuildManager` は `sessionStatusUpdated` / `stageSnapshotUpdated` / `taskProgressUpdated` / `heartbeat` の4イベントを発行する。
- `useLocationProgress` はcanonical eventを共有state treeへ適用し、`BuildSessionStatus` と `BuildTaskCountSummary` をUI表示用に導出する。セッションphaseとタスク件数を単一のWorkerイベントへ再結合しない。
- 認証失敗や通信エラーが発生した場合は、Shape Plugin の通知設計を踏襲し、中断・再試行・キャンセルを制御する。

### 6. UI 方針
- Location の進捗ダイアログは `BuildSessionProgressPanel` と共通 canonical subscription/control kernel を使用する。
- Location build manager は当面 UI realm で実行されるため、subscription と command は `same-realm` transport を明示選択する。Worker transport への暗黙 fallback は行わない。
- Start / Pause / Resume / queued Cancel は `canonicalBuildAPI` の canonical command へ接続し、React local state による疑似 pause/cancel や console-only cancel は持たない。
- 認証通知、ログ、地図プレビュー、データテーブルタブは Location adapter の固有責務として保持する。

### 7. 保守・拡張ポイント
- データソース別のパーサ／バリデータを `services/datasources` で拡張可能にする。
- 既存の `LocationVectorTileService` を活用しつつ、`prepareSession` 時の設定（タイル解像度、並列数など）を `LocationBuildConfig` で指定できるようにする。
- セッション再開／クリーンアップ／ログ蓄積などの運用周りは Shape Plugin と同様に Dexie のセッションテーブルを活用し、未完了セッション検知や LRU クリーニングを実装する。

### 8. セッション管理の DoD とテスト方針（将来案）

UnifiedLocationBuildManager と LocationBuildSessionManager の組み合わせで、将来次の条件を満たすことを完了条件（Definition of Done）とする。

1. **prepareSession（将来案）**
   - 一時ストア（EphemeralLocationDB など）へ `points`・`settings`・`config` を保存する。
   - TTL によるクリーンアップを実装し、テストでは `storedAt` を偽装して削除されることを確認する。

2. **startBuildSession（将来案）**
   - 一時ストアからデータを取り出し、`sessions` に `status=running`・`totalPoints`・`zoomMin/zoomMax` を記録する。
   - LocationPoints の永続化（`appendLocationPoints`）完了後にタイル生成へ進む。統合テストでは `LocationDB.features` に書き込まれるレコード数をアサートする。

3. **progress / completion**
   - `taskProgressUpdated` はタスク単位の進捗だけを更新し、`sessionStatusUpdated` が完了時の `completed`、失敗時の `failed` を通知する。
   - Dexie の値を読み出して検証するユニットテストを用意する。

4. **resume / pause / cancel**
   - `resume(sessionId)` 呼び出し時に `sessions` の状態が `running` に戻ること。
   - Pause / Cancel は `LocationBuildSession` への委譲を spy で確認する。`UnifiedLocationBuildManager.test.ts` に pause / resume / cancel の委譲テストを追加済み。

5. **ベクトルタイル生成（将来案）**
   - `LocationVectorTileService` を介して生成したタイルが `vectorTiles` に保存され、`hash` と `featureCount` を保持する。
   - 再生成時は `clearSession` → `bulkPut` の流れで上書きされる。

#### 推奨テスト追加
- `services/build/__tests__/UnifiedLocationBuildManager.test.ts`
  - pending → start → progress → completion の一連フローをモック化し、Dexie のレコードをアサート（実装済み）。
  - Pause/Resume/Cancel が `LocationBuildSessionManager` を呼ぶか spy で確認（実装済み）。
- `services/pointRepository.test.ts`（新規）
  - `appendLocationPoints` / `replaceLocationPoints` / `clearLocationPoints` が Dexie 永続テーブルへ反映されること。
- `services/tiles/LocationVectorTileService.test.ts`
  - タイル生成→保存と `clearSession` の挙動を確認。
