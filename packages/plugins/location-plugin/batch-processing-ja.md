## バッチ処理概要

LocationDialog における Start Batch は以下の段階で構成する。

### 1. データ取得フェーズ
- ユーザーが指定したデータソース設定（CSV / GeoJSON / 外部 API など）をもとに、ダウンロードまたは API アクセスを実行し raw データを取得する。
- 取得したデータはバッチセッション開始前に検証（ファイル形式・エンコーディング・ヘッダー構造など）し、問題があれば即座にフィードバックする。

### 2. パース & LocationPoint 化
- raw データを行単位またはレコード単位で解析し、アプリで永続的に利用する `LocationPoint` 型へ整形する。
- `LocationPoint` は以下のフィールドを持ち、ベクトルタイルの各 Point フィーチャーの同名プロパティと値を完全に一致させる。
  - `pid`（点 ID）
  - `name`
  - `latitude` / `longitude`
  - `kind`（点の種類: POI / 拠点 / etc.）
  - `gid0`（国 ID）, `gid1`（行政レベル 1 ID）, `gid2`（行政レベル 2 ID）
  - `payload`（種別ごとの拡張情報）
- 変換時に必須フィールドが欠落しているレコードは検出し、ログ・リトライ・スキップなどを一元管理する。

#### LocationPoint 型案
```ts
import type { GroupEntity } from '@hierarchidb/common-type';

type LocationPoint<TPayload extends Record<string, unknown>> = GroupEntity<string> & {
  schemaVersion: 1;
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
  kind: string;
  /** 行政区分 ID。gid0: 国, gid1: 都道府県相当, gid2: 市区町村相当 */
  gid0: string;
  gid1?: string;
  gid2?: string;
  /** ベクトルタイルにも埋め込む追加属性（カテゴリや tags 等） */
  payload: TPayload;
  /** データソースメタ（取得元 URL / 変換ルール ID 等） */
  source?: {
    provider: string;
    fetchedAt: number;
    originalId?: string;
  };
};
```

代表的な payload 型（詳細は `src/types/payloads.ts` を参照）:

```ts
interface OsmPointPayload {
  osmId: string;
  osmType: 'node' | 'way' | 'relation';
  tags: Record<string, string>;
  categories?: string[];
  lastSeenAt?: number;
}

interface OverpassPointPayload extends OsmPointPayload {
  overpassQuery?: string;
}

interface GeoNamesPointPayload {
  geonameId: number;
  featureClass: string;
  featureCode: string;
  population?: number;
  elevation?: number;
  timezone?: string;
  adminCodes?: { level1?: string; level2?: string };
  alternateNames?: string[];
}

interface WikidataPointPayload {
  entityId: string;
  labels: Record<string, string>;
  descriptions?: Record<string, string>;
  wikipediaTitle?: string;
  instanceOf?: string[];
  properties?: Record<string, unknown>;
}

interface CustomPointPayload {
  schemaVersion: number;
  attributes: Record<string, unknown>;
}

type LocationPointPayloadBySource = {
  openstreetmap: OsmPointPayload;
  overpass: OverpassPointPayload;
  geonames: GeoNamesPointPayload;
  wikidata: WikidataPointPayload;
  custom: CustomPointPayload;
  manual: CustomPointPayload;
};
```

各データソース向けパーサはストラテジーパターンで実装し、上記 payload 型を返すようにする。これにより、Generics で `LocationPoint<LocationPointPayloadBySource[S]>` を指定するだけで、型安全に属性へアクセスできる。

### 3. 永続化フェーズ（Persistent DB）
- 完成した `LocationPoint` を Ephemeral DB ではなく永続ストア（Dexie 永続テーブル / BFF 経由の本番 DB）へ保存する。既存エンティティと重複する場合はアップサートポリシーを定義する。
- バッチセッションのメタデータ（設定値・取得元・処理数・最終更新時刻など）は `locations_sessions` のようなセッション管理テーブルに記録する。

### 4. ベクトルタイル生成フェーズ
- 永続化した `LocationPoint` 群をもとに、ズーム範囲（例: 5〜14）ごとのベクトルタイルを生成する。Shape Plugin にならい、`LocationVectorTileService` を通じて Worker にタイル生成を委譲する。
- 生成されたタイルは `vector_tiles` テーブルやオブジェクトストレージに保存し、`pid / gid0 / gid1 / gid2` などの属性をプロパティとして埋め込む。

### 5. 進捗監視と通知
- `UnifiedLocationBatchManager` + `WorkerBridge` を用い、`prepareSession → startBatchSession → onBatchProgress` の流れを確立する。
- `useLocationProgress` フックで進捗イベント（download / parse / persist / tiles / completed）を購読し、ダイアログや通知センターへ表示する。
- 認証失敗や通信エラーが発生した場合は、Shape Plugin の通知設計を踏襲し、中断・再試行・キャンセルを制御する。

### 6. UI 方針
- LocationDialog のフッターに Start Batch ボタンを追加し、`canStartBatch` 条件を「名称入力済み」「利用規約チェック済み」「データソース選択済み」などに設定する。
- Start Batch 押下時には、ダイアログのワーキングコピーから最新設定を収集して `prepareSession` を呼び出し、そのまま Worker へセッション開始を指示する。
- バッチ専用の進捗ダイアログ（または Drawer）を導入し、処理状況・エラー・完了通知をリアルタイムに提示する。

### 7. 保守・拡張ポイント
- データソース別のパーサ／バリデータを `services/datasources` で拡張可能にする。
- 既存の `LocationVectorTileService` を活用しつつ、`prepareSession` 時の設定（タイル解像度、並列数など）を `LocationBatchConfig` で指定できるようにする。
- セッション再開／クリーンアップ／ログ蓄積などの運用周りは Shape Plugin と同様に Dexie のセッションテーブルを活用し、未完了セッション検知や LRU クリーニングを実装する。
