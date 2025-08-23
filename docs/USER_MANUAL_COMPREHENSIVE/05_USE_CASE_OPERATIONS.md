# 第5部 ユースケースごとの操作 ⭐️⭐️⭐️⭐️

## Chapter 6,7: 欠番

## Chapter 8: 地理データ管理

この章では、Shape Pluginを使用した地理データの管理と可視化について説明します。地図データの設定から、地理的形状の管理、空間分析まで、GIS（地理情報システム）的な機能を活用したデータ管理の方法を詳しく解説します。

```mermaid
mindmap
  root((地理データ管理))
    地図データの利用
      ベースマップ設定
      レイヤー管理
      地図表示
    地理的形状管理
      Shapeデータ作成
      境界データ管理
      地理情報可視化
    分析と共有
      空間分析
      データエクスポート
      地図共有
```

### 8.1 地図データの利用 ❌

#### 8.1.1 ベースマップ設定 ❌

地図表示の基盤となるベースマップの設定を行います。

**利用可能ベースマップの種類**

```mermaid
graph TB
    subgraph "ベースマップの種類"
        OSM["OpenStreetMap"]
        Satellite["衛星画像"]
        Terrain["地形図"]
        Custom["カスタムマップ"]
        
        OSMFeatures["・オープンソース<br/>・詳細道路情報<br/>・多言語対応<br/>・無料利用可能"]
        SatelliteFeatures["・高解像度画像<br/>・最新の状況<br/>・建物・植生確認<br/>・有料サービス"]
        TerrainFeatures["・標高データ<br/>・等高線表示<br/>・地形の起伏<br/>・アウトドア用途"]
        CustomFeatures["・組織専用地図<br/>・特殊用途対応<br/>・独自データ統合<br/>・高度なカスタマイズ"]
        
        OSM --> OSMFeatures
        Satellite --> SatelliteFeatures
        Terrain --> TerrainFeatures
        Custom --> CustomFeatures
    end
    
    classDef basemap fill:#e1f5fe
    classDef features fill:#f3e5f5
    
    class OSM,Satellite,Terrain,Custom basemap
    class OSMFeatures,SatelliteFeatures,TerrainFeatures,CustomFeatures features
```

**ベースマップ設定項目**

| 設定項目 | 説明 | 設定値例 | 注意事項 |
|----------|------|----------|----------|
| **地図タイプ** | ベースマップの種類 | OpenStreetMap | 利用規約要確認 |
| **URL テンプレート** | タイル画像のURL | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | {x},{y},{z}必須 |
| **最大ズームレベル** | 拡大可能倍率 | 18 | データ提供者の制限 |
| **属性情報** | クレジット表記 | "© OpenStreetMap contributors" | 著作権表示義務 |
| **利用制限** | アクセス制限 | 1000リクエスト/日 | 過度な利用は禁止 |

#### 8.1.2 レイヤー管理 ❌

地図上に表示する情報の階層管理です。

**レイヤーの種類**

```mermaid
graph LR
    subgraph "地図レイヤー構成"
        BaseLayer["ベースレイヤー"]
        VectorLayer["ベクターレイヤー"]
        RasterLayer["ラスターレイヤー"]
        OverlayLayer["オーバーレイレイヤー"]
        
        BaseContent["・ベースマップ<br/>・背景地図<br/>・地形情報"]
        VectorContent["・行政境界<br/>・道路網<br/>・建物形状<br/>・ポイント情報"]
        RasterContent["・衛星画像<br/>・航空写真<br/>・気象データ<br/>・標高データ"]
        OverlayContent["・注釈<br/>・マーカー<br/>・測定結果<br/>・一時情報"]
        
        BaseLayer --> BaseContent
        VectorLayer --> VectorContent
        RasterLayer --> RasterContent
        OverlayLayer --> OverlayContent
    end
    
    classDef layer fill:#e1f5fe
    classDef content fill:#f3e5f5
    
    class BaseLayer,VectorLayer,RasterLayer,OverlayLayer layer
    class BaseContent,VectorContent,RasterContent,OverlayContent content
```

**レイヤー操作**

| 操作 | 方法 | 効果 | ショートカット |
|------|------|------|----------------|
| **表示/非表示** | チェックボックス | レイヤーの可視性切替 | - |
| **透明度調整** | スライダー | レイヤーの透明度変更 | - |
| **順序変更** | ドラッグ&ドロップ | レイヤーの重ね順変更 | - |
| **ズーム連動** | 設定チェック | ズームレベルで表示制御 | - |
| **スタイル変更** | スタイル設定 | 色・線幅・シンボル変更 | - |

#### 8.1.3 地図表示 ❌

インタラクティブな地図表示機能です。

**地図ナビゲーション**

```mermaid
graph TB
    subgraph "地図操作機能"
        Pan["パン（移動）"]
        Zoom["ズーム"]
        Rotate["回転"]
        Measure["計測"]
        
        PanMethods["・マウスドラッグ<br/>・キーボード矢印<br/>・ナビゲーションパッド"]
        ZoomMethods["・マウスホイール<br/>・ダブルクリック<br/>・ズームボタン<br/>・範囲指定ズーム"]
        RotateMethods["・Shift+ドラッグ<br/>・回転ボタン<br/>・角度入力"]
        MeasureMethods["・距離測定<br/>・面積測定<br/>・角度測定<br/>・座標表示"]
        
        Pan --> PanMethods
        Zoom --> ZoomMethods
        Rotate --> RotateMethods
        Measure --> MeasureMethods
    end
    
    classDef operation fill:#e1f5fe
    classDef methods fill:#f3e5f5
    
    class Pan,Zoom,Rotate,Measure operation
    class PanMethods,ZoomMethods,RotateMethods,MeasureMethods methods
```

### 8.2 地理的形状管理 ⭐️⭐️

#### 8.2.1 Shape データ作成 ⭐️⭐️

地理的な形状データの作成と編集機能です。

**Shape データの作成方法**

| 作成方法 | 説明 | 適用場面 | データ形式 |
|----------|------|----------|------------|
| **手動描画** | 地図上でポリゴン描画 | カスタム境界作成 | GeoJSON |
| **ファイルインポート** | Shapefileアップロード | 既存GISデータ利用 | .shp, .kml, .gpx |
| **座標入力** | 座標値の直接入力 | 正確な位置指定 | 緯度経度 |
| **外部API連携** | 地理データサービス連携 | 行政境界等の標準データ | API レスポンス |

**Shape データ作成ダイアログ**

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as 地図インターフェース
    participant DrawTool as 描画ツール
    participant Validator as データ検証
    participant Storage as データ保存
    
    User->>UI: Shape作成開始
    UI->>DrawTool: 描画モード開始
    User->>DrawTool: 地図上でポリゴン描画
    DrawTool->>UI: 座標データ生成
    UI->>User: プロパティ入力フォーム
    User->>UI: 名前・説明等入力
    UI->>Validator: データ検証
    Validator->>UI: 検証結果
    UI->>Storage: Shapeデータ保存
    Storage->>UI: 保存完了通知
    UI->>User: 作成完了表示
```

#### 8.2.2 境界データ管理 ⭐️⭐️

行政境界や特定エリアの境界データ管理です。

**境界データの階層管理**

```mermaid
graph TB
    subgraph "境界データの階層構造"
        Country["国境"]
        Prefecture["都道府県境"]
        City["市区町村境"]
        District["地区・町境"]
        Custom["カスタム境界"]
        
        CountryData["・国際境界<br/>・海岸線<br/>・主要河川"]
        PrefectureData["・都道府県界<br/>・県庁所在地<br/>・主要都市"]
        CityData["・市区町村界<br/>・役所位置<br/>・人口データ"]
        DistrictData["・町丁目境界<br/>・郵便番号区域<br/>・選挙区"]
        CustomData["・営業エリア<br/>・配送範囲<br/>・影響区域"]
        
        Country --> CountryData
        Prefecture --> PrefectureData
        City --> CityData
        District --> DistrictData
        Custom --> CustomData
    end
    
    classDef boundary fill:#e1f5fe
    classDef data fill:#f3e5f5
    
    class Country,Prefecture,City,District,Custom boundary
    class CountryData,PrefectureData,CityData,DistrictData,CustomData data
```

**境界データの属性管理**

| 属性カテゴリ | 属性名 | データ型 | 例 |
|--------------|--------|----------|-----|
| **識別情報** | ID, コード, 名称 | 文字列/数値 | "JP-13", "東京都" |
| **地理情報** | 面積, 周囲長, 中心点 | 数値, 座標 | 2,194 km², (35.676, 139.650) |
| **統計情報** | 人口, 世帯数, 人口密度 | 数値 | 13,960,236人 |
| **管理情報** | 作成日, 更新日, 精度 | 日付, 数値 | 2024-01-01, ±10m |

#### 8.2.3 地理情報可視化（開発予定） ⭐️⭐️

地理データの効果的な可視化手法です。

**可視化手法**

```mermaid
graph LR
    subgraph "地理情報可視化手法"
        Choropleth["コロプレス図"]
        Symbols["シンボル表示"]
        Heatmap["ヒートマップ"]
        Flow["フロー表示"]
        
        ChoroplethDesc["・色分け表示<br/>・統計値の可視化<br/>・比較分析<br/>・密度表現"]
        SymbolsDesc["・アイコン表示<br/>・サイズ変更<br/>・属性表現<br/>・カテゴリ分類"]
        HeatmapDesc["・密度表示<br/>・集積の可視化<br/>・ホットスポット<br/>・グラデーション"]
        FlowDesc["・移動表現<br/>・関係性表示<br/>・流量表現<br/>・ネットワーク"]
        
        Choropleth --> ChoroplethDesc
        Symbols --> SymbolsDesc
        Heatmap --> HeatmapDesc
        Flow --> FlowDesc
    end
    
    classDef visualization fill:#e1f5fe
    classDef description fill:#f3e5f5
    
    class Choropleth,Symbols,Heatmap,Flow visualization
    class ChoroplethDesc,SymbolsDesc,HeatmapDesc,FlowDesc description
```

### 8.3 分析と共有（開発予定） ❌❌

#### 8.3.1 空間分析 ❌❌

地理データを活用した空間的な分析機能です。

**空間分析機能**

| 分析機能 | 説明 | 入力データ | 出力結果 |
|----------|------|------------|----------|
| **バッファー分析** | 指定距離内の範囲作成 | ポイント/ライン + 距離 | ポリゴン境界 |
| **オーバーレイ分析** | 複数図形の重ね合わせ | 複数ポリゴン | 交差/結合領域 |
| **近接分析** | 最近隣の検索 | ポイント群 | 距離・方向情報 |
| **密度分析** | 分布密度の計算 | ポイント群 | 密度サーフェス |
| **ネットワーク分析** | 経路・到達圏分析 | 道路ネットワーク | 最短経路・所要時間 |

#### 8.3.2 データエクスポート ⭐️⭐️

地理データの外部出力機能です。

**エクスポート形式**

```mermaid
graph TB
    subgraph "エクスポート形式"
        Shapefile["Shapefile"]
        GeoJSON["GeoJSON"]
        KML["KML/KMZ"]
        CSV["CSV"]
        Image["画像出力"]
        
        ShapefileDesc["・GIS標準形式<br/>・複数ファイル構成<br/>・属性データ含む<br/>・.shp, .dbf, .shx"]
        GeoJSONDesc["・Web標準形式<br/>・JSON形式<br/>・軽量・可読性<br/>・API連携適"]
        KMLDesc["・Google Earth対応<br/>・XML形式<br/>・3D表示対応<br/>・Web表示"]
        CSVDesc["・属性データのみ<br/>・座標情報含む<br/>・Excel対応<br/>・統計分析用"]
        ImageDesc["・PNG/JPEG<br/>・印刷用高解像度<br/>・プレゼン資料<br/>・Web掲載用"]
        
        Shapefile --> ShapefileDesc
        GeoJSON --> GeoJSONDesc
        KML --> KMLDesc
        CSV --> CSVDesc
        Image --> ImageDesc
    end
    
    classDef format fill:#e1f5fe
    classDef description fill:#f3e5f5
    
    class Shapefile,GeoJSON,KML,CSV,Image format
    class ShapefileDesc,GeoJSONDesc,KMLDesc,CSVDesc,ImageDesc description
```

#### 8.3.3 地図共有（開発予定） ❌❌

作成した地図の共有とアクセス制御です。

**共有オプション**

| 共有方法 | アクセス制御 | 用途 | 機能制限 |
|----------|--------------|------|----------|
| **公開リンク** | なし | 一般公開 | 閲覧のみ |
| **パスワード保護** | パスワード認証 | 限定公開 | 閲覧のみ |
| **ユーザー招待** | アカウントベース | チーム共有 | 編集可能 |
| **埋め込みコード** | ドメイン制限 | Webサイト埋込 | 閲覧・基本操作 |
| **API提供** | APIキー認証 | システム連携 | データアクセス |

## Chapter 9: 表形式データ管理

この章では、Spreadsheet Pluginを使用した表形式データの管理について説明します。スプレッドシート形式での データ作成から分析、活用まで、表形式データを効果的に管理するための機能と操作方法を詳しく解説します。

```mermaid
mindmap
  root((表形式データ管理))
    スプレッドシート作成
      テーブル設計
      データ入力
      書式設定
    データ分析
      集計計算
      フィルタリング
      ソート
    データ活用
      グラフ作成
      レポート生成
      データ連携
```

### 9.1 スプレッドシート作成 ⭐️⭐️

#### 9.1.1 テーブル設計 ⭐️⭐️

効率的なデータ管理のためのテーブル構造設計です。

**テーブル設計の原則**

```mermaid
graph TB
    subgraph "テーブル設計原則"
        Normalization["正規化"]
        DataTypes["データ型定義"]
        Validation["入力検証"]
        Indexing["インデックス設計"]
        
        NormDetail["・重複排除<br/>・関係性明確化<br/>・更新異常防止<br/>・保守性向上"]
        TypeDetail["・数値/文字列/日付<br/>・制約条件<br/>・デフォルト値<br/>・NULL許可"]
        ValidDetail["・入力範囲制限<br/>・形式チェック<br/>・必須項目設定<br/>・一意性制約"]
        IndexDetail["・検索高速化<br/>・ソート最適化<br/>・パフォーマンス向上<br/>・メモリ効率"]
        
        Normalization --> NormDetail
        DataTypes --> TypeDetail
        Validation --> ValidDetail
        Indexing --> IndexDetail
    end
    
    classDef principle fill:#e1f5fe
    classDef detail fill:#f3e5f5
    
    class Normalization,DataTypes,Validation,Indexing principle
    class NormDetail,TypeDetail,ValidDetail,IndexDetail detail
```

**列設計のベストプラクティス**

| 設計項目 | 推奨事項 | 例 | 避けるべき点 |
|----------|----------|-----|--------------|
| **列名** | 短く明確で英数字 | product_name, price, created_at | 空白・特殊文字・長すぎる名前 |
| **データ型** | 適切な型を選択 | 数値→Number, 日付→Date | すべてText型での統一 |
| **必須項目** | 業務上必須なもののみ | ID, 名前, 作成日 | 過度な必須項目設定 |
| **デフォルト値** | 適切な初期値設定 | ステータス→"draft", 数量→0 | 無意味なデフォルト値 |
| **制約条件** | ビジネスルールを反映 | 価格 > 0, 日付 ≥ 今日 | 制約なしでの運用 |

#### 9.1.2 データ入力 ❌❌

効率的なデータ入力機能と操作方法です。
現在のところ、スプレッドシート機能としては、表示のみで、データ入力・編集には対応していません。


**データ入力方法（開発検討中）**

```mermaid
graph LR 
    subgraph "データ入力手段"
        Manual["手動入力"]
        Import["インポート"]
        Formula["数式入力"]
        Copy["コピー&ペースト"]
        Bulk["一括入力"]
        
        ManualFeatures["・セル編集<br/>・フォーム入力<br/>・ドロップダウン<br/>・バリデーション"]
        ImportFeatures["・CSVインポート<br/>・Excelインポート<br/>・データベース連携<br/>・API取得"]
        FormulaFeatures["・関数使用<br/>・計算式<br/>・参照<br/>・条件式"]
        CopyFeatures["・外部データ<br/>・範囲コピー<br/>・形式選択<br/>・変換貼付"]
        BulkFeatures["・パターン入力<br/>・連続データ<br/>・一括変更<br/>・テンプレート"]
        
        Manual --> ManualFeatures
        Import --> ImportFeatures
        Formula --> FormulaFeatures
        Copy --> CopyFeatures
        Bulk --> BulkFeatures
    end
    
    classDef input fill:#e1f5fe
    classDef features fill:#f3e5f5
    
    class Manual,Import,Formula,Copy,Bulk input
    class ManualFeatures,ImportFeatures,FormulaFeatures,CopyFeatures,BulkFeatures features
```

**入力支援機能(開発検討中)**

| 機能 | 説明 | 操作方法 | 効果 |
|------|------|----------|------|
| **オートコンプリート** | 過去入力値からの候補表示 | 文字入力時に自動表示 | 入力速度向上 |
| **データ検証** | 入力値の妥当性チェック | 設定した条件での自動検証 | データ品質確保 |
| **ドロップダウンリスト** | 選択肢からの選択入力 | セルクリックでリスト表示 | 入力ミス防止 |
| **連続データ入力** | パターンベースの自動入力 | 範囲選択してフィル | 作業効率化 |
| **数式コピー** | 相対/絶対参照での数式複製 | 数式セルのコピー&ペースト | 計算の自動化 |

#### 9.1.3 書式設定 ❌❌

データの視認性向上のための書式設定機能です。実装は完了していません。

**書式設定の種類**

```mermaid
graph TB
    subgraph "書式設定カテゴリ"
        CellFormat["セル書式"]
        FontFormat["フォント"]
        BorderFormat["境界線"]
        ColorFormat["色・背景"]
        AlignFormat["配置"]
        
        CellOptions["・数値形式<br/>・日付形式<br/>・通貨形式<br/>・パーセント"]
        FontOptions["・フォント種類<br/>・サイズ<br/>・スタイル<br/>・色"]
        BorderOptions["・線種<br/>・太さ<br/>・色<br/>・スタイル"]
        ColorOptions["・セル背景色<br/>・文字色<br/>・グラデーション<br/>・パターン"]
        AlignOptions["・水平配置<br/>・垂直配置<br/>・テキスト回転<br/>・折り返し"]
        
        CellFormat --> CellOptions
        FontFormat --> FontOptions
        BorderFormat --> BorderOptions
        ColorFormat --> ColorOptions
        AlignFormat --> AlignOptions
    end
    
    classDef format fill:#e1f5fe
    classDef options fill:#f3e5f5
    
    class CellFormat,FontFormat,BorderFormat,ColorFormat,AlignFormat format
    class CellOptions,FontOptions,BorderOptions,ColorOptions,AlignOptions options
```

### 9.2 データ分析 ❌❌

#### 9.2.1 集計・計算 ❌❌

データの集計と分析のための計算機能です。実装は完了していません。

**集計関数の種類**

| 関数カテゴリ | 主要関数 | 用途 | 例 |
|-------------|----------|------|-----|
| **統計関数** | SUM, AVERAGE, COUNT | 基本統計 | `=SUM(A1:A10)` |
| **条件付き集計** | SUMIF, COUNTIF | 条件指定集計 | `=SUMIF(B:B,">100",C:C)` |
| **検索・参照** | VLOOKUP, INDEX, MATCH | データ検索 | `=VLOOKUP(A2,D:E,2,FALSE)` |
| **日付・時間** | TODAY, YEAR, DATEDIF | 日付計算 | `=DATEDIF(A2,TODAY(),"Y")` |
| **文字列** | CONCATENATE, LEFT, MID | 文字列操作 | `=CONCATENATE(A2," ",B2)` |
| **論理関数** | IF, AND, OR | 条件判定 | `=IF(A2>100,"高","低")` |

#### 9.2.2 フィルタリング ❌❌

データの絞り込みと条件指定表示機能です。

**フィルタリング機能**

```mermaid
graph LR
    subgraph "フィルタリング機能"
        AutoFilter["オートフィルタ"]
        CustomFilter["カスタムフィルタ"]
        AdvancedFilter["詳細フィルタ"]
        SlicerFilter["スライサー"]
        
        AutoFeatures["・ドロップダウン選択<br/>・チェックボックス<br/>・テキスト検索<br/>・数値範囲"]
        CustomFeatures["・複数条件組合せ<br/>・AND/OR演算<br/>・比較演算子<br/>・ワイルドカード"]
        AdvancedFeatures["・複雑条件設定<br/>・計算結果利用<br/>・他テーブル参照<br/>・動的条件"]
        SlicerFeatures["・視覚的操作<br/>・複数項目連動<br/>・ボタン形式<br/>・リアルタイム"]
        
        AutoFilter --> AutoFeatures
        CustomFilter --> CustomFeatures
        AdvancedFilter --> AdvancedFeatures
        SlicerFilter --> SlicerFeatures
    end
    
    classDef filter fill:#e1f5fe
    classDef features fill:#f3e5f5
    
    class AutoFilter,CustomFilter,AdvancedFilter,SlicerFilter filter
    class AutoFeatures,CustomFeatures,AdvancedFeatures,SlicerFeatures features
```

#### 9.2.3 ソート 

データの並び替え機能です。

**ソート機能の種類**

| ソート種類 | 説明 | 操作方法 | 適用場面 |
|------------|------|----------|----------|
| **単一キーソート** | 1つの列での並び替え | 列ヘッダクリック | 基本的な並び替え |
| **複数キーソート** | 複数条件での並び替え | ソートダイアログ使用 | 階層的な並び替え |
| **カスタムソート** | ユーザー定義順序 | カスタムリスト使用 | 月名、曜日等の順序 |
| **条件付きソート** | 条件に応じた並び替え | フィルタと組み合わせ | 特定条件下でのソート |

### 9.3 データ活用 ❌❌

#### 9.3.1 グラフ作成 ❌❌❌

データの可視化のためのグラフ作成機能です。実装は完了していません。

**グラフの種類と用途**

```mermaid
graph TB
    subgraph "グラフの種類"
        ColumnChart["縦棒グラフ"]
        LineChart["線グラフ"]
        PieChart["円グラフ"]
        ScatterChart["散布図"]
        AreaChart["面グラフ"]
        
        ColumnUse["・カテゴリ比較<br/>・時系列比較<br/>・ランキング表示<br/>・実績対比"]
        LineUse["・時系列変化<br/>・トレンド分析<br/>・推移表示<br/>・予測線"]
        PieUse["・構成比表示<br/>・シェア表示<br/>・割合表現<br/>・全体に対する比率"]
        ScatterUse["・相関関係<br/>・分布状況<br/>・クラスター分析<br/>・外れ値検出"]
        AreaUse["・累積表示<br/>・積み重ね比較<br/>・ボリューム表現<br/>・全体の変化"]
        
        ColumnChart --> ColumnUse
        LineChart --> LineUse
        PieChart --> PieUse
        ScatterChart --> ScatterUse
        AreaChart --> AreaUse
    end
    
    classDef chart fill:#e1f5fe
    classDef usage fill:#f3e5f5
    
    class ColumnChart,LineChart,PieChart,ScatterChart,AreaChart chart
    class ColumnUse,LineUse,PieUse,ScatterUse,AreaUse usage
```

#### 9.3.2 データ連携 ❌❌

他システムとのデータ連携機能です。
実装は完了していません。

**連携方法**

```mermaid
graph LR
    subgraph "データ連携方式"
        Export["エクスポート連携"]
        Import["インポート連携"]
        API["API連携"]
        RealTime["リアルタイム連携"]
        
        ExportMethods["・CSV出力<br/>・Excel出力<br/>・JSON出力<br/>・PDF出力"]
        ImportMethods["・ファイル読込<br/>・データベース接続<br/>・Web取得<br/>・クリップボード"]
        APIMethods["・REST API<br/>・GraphQL<br/>・Webhook<br/>・RPC"]
        RealTimeMethods["・データ同期<br/>・変更通知<br/>・自動更新<br/>・双方向連携"]
        
        Export --> ExportMethods
        Import --> ImportMethods
        API --> APIMethods
        RealTime --> RealTimeMethods
    end
    
    classDef integration fill:#e1f5fe
    classDef methods fill:#f3e5f5
    
    class Export,Import,API,RealTime integration
    class ExportMethods,ImportMethods,APIMethods,RealTimeMethods methods
```

**まとめ**

ユースケースごとの操作では、HierarchiDBの各プラグインを活用した実践的な業務シナリオを詳しく解説しました。プロジェクト管理では協調作業と進捗管理、データ整理では体系的な分類手法、地理データ管理では空間情報の可視化、表形式データ管理では分析とレポート作成について、具体的な操作手順とベストプラクティスを提供しました。これらの知識により、様々な業務シーンでHierarchiDBを効果的に活用できるようになります。