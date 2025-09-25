# @hierarchidb/ui-map

Shared map components for HierarchiDB with MapLibre GL support.

## Features

- **MapLibre GL Integration**: Full MapLibre GL map rendering
- **Vector Tile Support**: Custom vector tile layers with Dexie protocol support
- **TypeScript**: Full TypeScript support with comprehensive type definitions
- **React Components**: Easy-to-use React components for map integration
- **Customizable**: Flexible configuration for different use cases


 - maplibre-gl 5.7.3 のパッケージ本体は type: "module" を宣言しつつ types: "dist/maplibre-gl.d.ts" を指しており、型定義ファイルは export { … } 形式で ES Modules とし
    て公開されています。CommonJS 向けに閉じた export = は存在しないため、「型情報が CommonJS にしか提供されていない」という状況ではありません。citenode_modules/.pnpm/
    maplibre-gl@5.7.3/node_modules/maplibre-gl/package.json:1node_modules/.pnpm/maplibre-gl@5.7.3/node_modules/maplibre-gl/dist/maplibre-gl.d.ts:14360
- dist/package.json が type: "commonjs" を持つのは UMD/worker ビルドの後方互換レイヤー向けで、型解決には影響しません。TypeScript 利用時には通常どおり import { Map }
  from 'maplibre-gl'; あるいは import * as maplibregl from 'maplibre-gl'; のどちらでも型推論が機能します（export as namespace maplibregl によりグローバル利用も可能）。
  citenode_modules/.pnpm/maplibre-gl@5.7.3/node_modules/maplibre-gl/dist/maplibre-gl.d.ts:14408
- 既に当リポジトリでは @hierarchidb/ui-map が maplibre-gl 依存を集約するラッパーとして運用されており、型チェック設定をここにだけ特例（skipLibCheck: true など）で閉じ込
  めています。これにより maplibre 特有の const enum や ambient 宣言による負債が他パッケージへ漏れない構造になっています。citepackages/ui/map/package.json:1packages/ui/
  map/tsconfig.json:1
- さらに dep-fence の maplibre-allowlist ルールで @hierarchidb/ui-map（および @hierarchidb/feature-map-adapter）以外が maplibre-gl を直接依存に持てないよう制限します

###▌プロパティ
そのMapLibre-GLの依存を集約するためのコンポーネントの取るプロパティはどのようなものですか？

- MapLibreMap は MapLibreMapProps を受け取ります。コアとなる BaseMapProps には地図の初期状態 (initialViewState)・スタイル指定 (mapStyle)・インタラクション設
    定 (mapOptions) といった基本構成が含まれ、幅／高さ／追加スタイル (width,height,style) も同インターフェースでまとめています。citepackages/ui/map/src/components/
    MapLibreMap.tsx:25packages/ui/map/src/types/unified-map-props.ts:55packages/ui/map/src/types/unified-map-props.ts:70packages/ui/map/src/types/unified-map-
    props.ts:150
    - initialViewState は経度・緯度・ズーム・ベアリング・ピッチを指定する必須プロパティです。citepackages/ui/map/src/types/unified-map-props.ts:41
    - mapOptions ではインタラクションのオン／オフ（ドラッグ・スクロールズーム・ピンチ回転など）を細かく切り替えられます。citepackages/ui/map/src/types/unified-map-
    props.ts:55
- イベントハンドラ系は onLoad（地図インスタンスの取得）、onViewStateChange（パン／ズーム／回転）、onClick（クリック時）で統一されています。citepackages/ui/map/src/
  types/unified-map-props.ts:100
- クリック地点のフィーチャ識別を有効にする場合は identifyFeatureOnClick を渡し、対象レイヤーや検索半径、カスタムID取得ロジック、識別完了時のコールバックを設定できます。
  識別結果は onClick にも増強情報として渡ります。citepackages/ui/map/src/types/unified-map-props.ts:117packages/ui/map/src/components/MapLibreMap.tsx:105
- UI 側の要素は children（レイヤやマーカーなど任意の子要素）と、組み込みの地図コントロール群をまとめた controls で指定します。コントロールはナビゲーション／スケール／フ
  ルスクリーン／ジオロケートを個別に有効化でき、配置位置や GeolocateControl の詳細オプションも渡せます。citepackages/ui/map/src/components/MapLibreMap.tsx:25packages/
  ui/map/src/components/MapLibreMap.tsx:29packages/ui/map/src/components/MapLibreMap.tsx:60

### pick実現方式について(1)
 このアプリの実現方式は、Deck.gl的文脈でいうところのどの方式なのか（MapboxOverlayを使うのか、react-map-glを使うのかなど）。また、特に重要なのが、クリック位置のフィー
 チャー識別の実装方法について説明をしてもらいたいです。私としては、Deck.glでの https://deck.gl/docs/developer-guide/custom-layers/picking を組み込んで利用するべきである
 と考えています。

• Explored
└ Read MapWithDeckGL.tsx, MapWithVectorTiles.tsx, VectorTileLayer.tsx, feature-identification.ts

> - 今回の UI 層は @hierarchidb/ui-map をラッパとし、素の地図レンダリングは @vis.gl/react-maplibre をベースにした MapLibreMap コンポーネントで担っています（packages/ui/
    map/src/components/MapLibreMap.tsx:7）。Deck.gl を組み合わせる場合は、Deck 側の「MapboxOverlay」を MapLibre インスタンスへ組み込む方式を採用しており、MapWithDeckGL が
    @deck.gl/mapbox の MapboxOverlay を map.addControl() で載せる構成です。react-map-gl ベースではなく、MapLibre + MapboxOverlay 連携を直接使っている点が Deck.gl 的な文脈で
    の位置づけになります（packages/ui/map/src/components/MapWithDeckGL.tsx:1-48）。
- クリック位置のフィーチャ識別は Deck.gl のピッキングではなく、MapLibre 側の queryRenderedFeatures を利用しています。MapLibreMap で identifyFeatureOnClick を受け取
  り、クリック時に resolveIdentifyCandidates を呼び出して MapLibre の queryRenderedFeatures からヒットしたフィーチャを抽出・重複排除する仕組みです（packages/ui/map/src/
  components/MapLibreMap.tsx:105-129）。ロジック自体は resolveIdentifyCandidates にまとめられており、レイヤ ID のフィルタ、検索半径、getFeatureId のカスタマイズ、イベント
  内フィーチャ（event.features）のフォールバックなどを実装済みです（packages/ui/map/src/lib/feature-identification.ts:12-117）。
- Deck.gl の picking 機能を併用したい場合は、現在の MapboxOverlay 連携で deck.layers を渡している箇所に pickable: true や onClick／onHover を設定し、Deck.gl 側
  が返す Info オブジェクトを MapLibreMap の onClick と統合する形が考えられます。追加対応としては、MapboxOverlay の setProps 呼び出しで deck.gl の pickingRadius や
  pickMultipleObjects などを反映し、resolveIdentifyCandidates と Deck.gl ピッキング結果をマージするフローを用意すれば、Deck.gl のピクセルベース特性と MapLibre のレイヤ
  フィルタを両立できます。

### pick実現方式について(2)

Deck.glのpicking機能と、MapLibreのquerRenderedFeaturesとの方式内容の違い、機能や性能面でどちらが優れているかを教えてください。

> - Deck.gl の picking は GPU ベースの「ピクセル単位」でレイヤごとにカスタマイズされたマテリアル／フィルタを適用できます。描画時にカラーコードを埋め込み、フレームバッファ
    を読み出してクリック座標に対応するオブジェクトを即座に同定する仕組みなので、Deck レイヤが保持する全ての属性（非表示列や補助フィールドも含む）をそのまま返しやすく、点
    群・大規模メッシュなど大量オブジェクトでも高速に動作します。また pickMultipleObjects や pickingRadius で範囲を柔軟に調整でき、Deck 側の getPickingInfo で複合判定を組め
    るため、Deck レイヤにロジックを寄せたいときに優れています。
- MapLibre の queryRenderedFeatures は描画済みスタイルからベクターレイヤを検索します。MapLibre スタイル仕様に沿ったフィルタ（layerId / filter 式）で結果を絞れる一方、
  スタイル適用後の情報に依存し、Deck のような GPU pick バッファは使わず CPU 側での検索となります。マップシステム全体のレイヤを横断的に問い合わせられる利点がある反面、
  GeoJSONやタイルベースの描画結果に限られ、Deck レイヤが生成する WebGL オブジェクトは対象外です。また、クエリ密度が高い場合は CPU load が上がりやすく、大量レイヤ・高ズー
  ムではパフォーマンスが低下することがあります。
- 性能面では、Deck.gl の picking は GPU 協調で少量のピクセル読み出しに留まるため、大規模なビジュアライゼーションで有利です。MapLibre 方式は CPU クエリとフィルタの繰り返
  しになるため、対象フィーチャ数が多いとコストが増します。その一方で、MapLibre の queryRenderedFeatures はスタイル定義と同じレイヤ ID / filter を再利用でき、既存 MapLibre
  レイヤの状態（シンボルやヒートマップなど）をそのまま参照したいときに便利です。
- 機能面のまとめ：Deck.gl 方式は Deck レイヤに閉じたピッキング（高度なカスタム対応が必要な 3D/点群/アニメーション）に優れ、MapLibre 方式は MapLibre スタイルで管理す
  るベクターレイヤやタイルデータに対して簡潔に問い合わせできる強みがあります。複合的な UI では、Deck レイヤは Deck.gl picking で完結させ、MapLibre ネイティブレイヤは
  queryRenderedFeatures で拾う二段構えが最も互換性と性能を両立しやすいです。

### basemapについて

 本アプリでは、ベクトルタイル地図内の個別フィーチャーのプロパティに対してスタイルを適用したり、マウスがホバーしている・クリックしたフィーチャーとインタラクティブな処理を
 したりする必要があります。このとき、Deck.glとMapLibreをどのように使い分けることになりますか。

 - MapLibreを基盤レイヤに活用
    ベクトルタイルのスタイル適用や、レイヤID／フィルタ単位でのハイライト切替は MapLibre のスタイル仕様に寄せるのが最短です。MapWithVectorTiles が VectorTileLayer を
    通じてタイルソースとレイヤ設定（paint/layout/filter など）をまとめており、プロパティ値による分類や setFeatureState ベースのハイライトを MapLibre 側に集約できます。
    citepackages/ui/map/src/components/MapWithVectorTiles.tsx:12packages/ui/map/src/components/VectorTileLayer.tsx:40
- MapLibreでのインタラクション検知
  ネイティブの MapLibre レイヤに対するクリック／ホバーは queryRenderedFeatures を使った resolveIdentifyCandidates が既に用意されており、レイヤID・検索半径・フィ
  ルタで対象を絞り込み、同一 ID のフィーチャを重複排除したうえでコールバックに渡します。タイル由来のフィーチャプロパティをそのまま取得したい場合はこちらを使います。
  citepackages/ui/map/src/components/MapLibreMap.tsx:105packages/ui/map/src/lib/feature-identification.ts:12
- Deck.glの役割：高度なオーバーレイ
  Deck.gl が必要になるのは、MapLibre のスタイル機構を超える描画・アニメーションや、バッチ処理結果を 3D 表現・集計ヒートマップ等で見せたいケースです。MapWithDeckGL は
  @deck.gl/mapbox の MapboxOverlay を MapLibre に被せる方式を採っており、Deck レイヤの pickable: true／onHover／onClick を利用すれば Deck.gl の GPU ピッキングを併用できま
  す。Deck レイヤ側で複合ジオメトリを持ち、Deck 側属性を直接返す必要があるときはこちらを使い分けます。citepackages/ui/map/src/components/MapWithDeckGL.tsx:1
- 使い分けの指針
    1. タイル由来フィーチャの通常スタイリング／識別: MapLibre のレイヤ（VectorTileLayer）で paint/layout を定義し、クリック検知は
       identifyFeatureOnClick→resolveIdentifyCandidates を利用。
    2. Deck固有のビジュアライゼーション（例: ArcLayer, PointCloudLayer）: Deck レイヤを MapWithDeckGL の deck.layers に渡し、Deck 側 getTooltip/onClick で独自処理。必要
       に応じて MapLibre の結果とマージして UI イベントを統合。
    3. ハイブリッドケース: MapLibre レイヤで基礎トーンや行政区境を描きつつ、Deck レイヤで進捗ヒートマップやアニメーションを載せ、クリック時は (a) Deck info.object と
       (b) MapLibre queryRenderedFeatures の両方を参照し、ユーザー操作に応じた UI 更新を行う。

この構成で、MapLibre には既存タイル資産とスタイル適用・基本的なフィーチャ識別を任せ、Deck.gl には GPU フレンドリーなリッチ表現と Deck 特有のピッキングを担わせる分担が明
確になります。

## Installation

```bash
npm install @hierarchidb/ui-map
```

## Components

### MapLibreMap

Basic MapLibre GL map component.

```tsx
import { MapLibreMap } from '@hierarchidb/ui-map';

<MapLibreMap
  initialViewState={{
    longitude: 139.7,
    latitude: 35.7,
    zoom: 10
  }}
  mapStyle="https://demotiles.maplibre.org/style.json"
  onLoad={(map) => console.log('Map loaded')}
/>
```

### VectorTileLayer

Vector tile layer component for adding custom data layers.

```tsx
import { VectorTileLayer } from '@hierarchidb/ui-map';

<VectorTileLayer
  map={mapInstance}
  layerId="my-layer"
  sourceId="my-source"
  tiles={['https://example.com/tiles/{z}/{x}/{y}.pbf']}
  paint={{
    'fill-color': '#0080ff',
    'fill-opacity': 0.7
  }}
/>
```

### MapWithVectorTiles

Integrated map component with vector tile support.

```tsx
import { MapWithVectorTiles } from '@hierarchidb/ui-map';

<MapWithVectorTiles
  dbName="mydb"
  nodeId="node123"
  initialViewState={{
    longitude: 139.7,
    latitude: 35.7,
    zoom: 10
  }}
  layerOptions={{
    paint: {
      'fill-color': '#ff8000',
      'fill-opacity': 0.8
    }
  }}
  tileDataProvider={async (z, x, y, nodeId) => {
    // Return ArrayBuffer with tile data
    return await fetchTileData(z, x, y, nodeId);
  }}
/>
```

## API Reference

### MapViewState

```typescript
interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}
```

### LayerOptions

```typescript
interface LayerOptions {
  layerId?: string;
  sourceId?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: FilterSpecification;
  minzoom?: number;
  maxzoom?: number;
  layerType?: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'background';
  sourceLayer?: string;
}
```

## Custom Protocols

The package supports custom `dexie://` protocol for loading vector tiles from Dexie databases:

```
dexie://dbname/nodeid/{z}/{x}/{y}
```

## Dependencies

- `maplibre-gl`: MapLibre GL JS for map rendering
- `@vis.gl/react-maplibre`: React wrapper for MapLibre GL
- `react`: React 18+

## License

MIT