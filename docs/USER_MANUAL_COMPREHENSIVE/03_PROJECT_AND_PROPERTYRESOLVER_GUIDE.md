# Project と PropertyResolver 完全ガイド

わかりやすい図と実例で学ぶ、HierarchiDBの中核機能

## 目次
1. [Projectとは？](#projectとは)
2. [PropertyResolverとは？](#propertyresolverとは)
3. [実例で学ぶProject](#実例で学ぶproject)
4. [実例で学ぶPropertyResolver](#実例で学ぶpropertyresolver)
5. [よくあるパターン集](#よくあるパターン集)

---

## Projectとは？

### 📦 Projectは「データのコンテナ」

Projectは、関連するデータをまとめて管理する**コンテナ**です。
レゴブロックのように、いろいろなデータを組み合わせて、ひとつの作品を作るイメージです。

```mermaid
graph TB
    subgraph "東京観光プロジェクト"
        S[🗾 23区の境界<br/>Shape]
        L1[📍 観光地<br/>Location]
        L2[📍 駅<br/>Location]
        R[🛤️ 地下鉄路線<br/>Route]
        Style[🎨 エリア色分け<br/>Styler]
    end
    
    S -.->|表示| Map[🗺️ 地図]
    L1 -.->|表示| Map
    L2 -.->|表示| Map
    R -.->|表示| Map
    Style -.->|適用| S
```

### なぜProjectが必要？

#### ❌ Projectがない場合
```
📁 データ
├── 東京の境界.shp
├── 観光地リスト.csv
├── 駅データ.json
└── 地下鉄路線.geojson

→ バラバラで管理が大変！
→ どれとどれが関連するか不明！
```

#### ✅ Projectがある場合
```
📦 東京観光プロジェクト
├── 🗾 23区の境界
├── 📍 観光地（浅草寺、スカイツリー...）
├── 📍 駅（東京駅、新宿駅...）
└── 🛤️ 地下鉄路線

→ 関連データが一目瞭然！
→ まとめて管理・更新できる！
```

---

## PropertyResolverとは？

### 🔄 PropertyResolverは「翻訳機」

PropertyResolverは、データ間の**翻訳機**や**連結器**のような役割を果たします。

```mermaid
graph LR
    subgraph "入力データ"
        A[空港コード<br/>"NRT"]
        B[国コード<br/>"JP"]
    end
    
    subgraph "PropertyResolver<br/>🔄 変換・翻訳"
        T[変換ルール]
    end
    
    subgraph "出力データ"
        C[空港名<br/>"成田国際空港"]
        D[国名<br/>"日本"<br/>"Japan"]
    end
    
    A --> T
    B --> T
    T --> C
    T --> D
```

### わかりやすい例：コーヒーショップ

```mermaid
graph TB
    subgraph "注文（入力）"
        Order[Sサイズ]
    end
    
    subgraph "PropertyResolver"
        Rules[変換ルール<br/>S→Short<br/>S→240ml<br/>S→¥300]
    end
    
    subgraph "結果（出力）"
        R1[英語表記: Short]
        R2[容量: 240ml]
        R3[価格: ¥300]
    end
    
    Order --> Rules
    Rules --> R1
    Rules --> R2
    Rules --> R3
```

---

## 実例で学ぶProject

### 例1: 日本の交通ネットワークプロジェクト

#### Step 1: プロジェクトの構成を決める

```mermaid
graph TB
    subgraph "📦 日本交通ネットワーク"
        subgraph "Location（地点）"
            L1[✈️ 空港]
            L2[🚉 新幹線駅]
            L3[⚓ 主要港]
        end
        
        subgraph "Route（経路）"
            R1[✈️ 国内航空路]
            R2[🚄 新幹線]
            R3[🚢 フェリー航路]
        end
        
        subgraph "Shape（エリア）"
            S1[🗾 都道府県]
        end
    end
```

#### Step 2: データを追加していく

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Project as プロジェクト
    participant Location as Location Plugin
    participant Route as Route Plugin
    
    User->>Project: プロジェクト作成
    
    User->>Location: 空港データ追加
    Location-->>Project: ✈️ 50空港
    
    User->>Location: 新幹線駅追加
    Location-->>Project: 🚉 100駅
    
    User->>Route: 航空路追加
    Route-->>Project: ✈️ 200路線
    
    User->>Route: 新幹線追加
    Route-->>Project: 🚄 10路線
    
    Project->>User: 統合地図表示
```

#### Step 3: 結果

```
📦 日本交通ネットワーク
├── 📍 150地点（空港50 + 駅100）
├── 🛤️ 210路線（航空200 + 新幹線10）
└── 🗾 47都道府県

→ すべてが地図上に統合表示される！
```

### 例2: 災害対策プロジェクト

```mermaid
graph TB
    subgraph "📦 災害対策プロジェクト"
        subgraph "平常時データ"
            N1[🏥 病院]
            N2[🏫 避難所]
            N3[🚒 消防署]
        end
        
        subgraph "リスクデータ"
            R1[🌊 浸水想定区域]
            R2[⛰️ 土砂災害警戒区域]
            R3[🔥 火災危険区域]
        end
        
        subgraph "避難データ"
            E1[➡️ 避難経路]
            E2[🚦 通行可能道路]
        end
    end
    
    N1 & N2 & N3 --> Analysis[統合分析]
    R1 & R2 & R3 --> Analysis
    E1 & E2 --> Analysis
    
    Analysis --> Result[🗺️ 防災マップ]
```

### 例3: 観光案内プロジェクト

```mermaid
graph LR
    subgraph "📦 京都観光プロジェクト"
        Temple[⛩️ 寺社<br/>Location]
        Restaurant[🍜 レストラン<br/>Location]
        Hotel[🏨 ホテル<br/>Location]
        BusRoute[🚌 バス路線<br/>Route]
        WalkRoute[🚶 観光ルート<br/>Route]
        District[🏛️ 観光エリア<br/>Shape]
    end
    
    Temple --> Recommend[おすすめコース生成]
    Restaurant --> Recommend
    WalkRoute --> Recommend
    
    Recommend --> Tourist[👥 観光客に提供]
```

---

## 実例で学ぶPropertyResolver

### 例1: 空港コードの変換

#### 設定前：意味不明なコード
```
NRT, HND, KIX, NGO, CTS...
```

#### PropertyResolver設定
```mermaid
graph TB
    subgraph "変換ルール"
        Rule1[NRT → 成田空港]
        Rule2[HND → 羽田空港]
        Rule3[KIX → 関西空港]
        Rule4[NGO → 中部空港]
        Rule5[CTS → 新千歳空港]
    end
```

#### 設定後：わかりやすい名前で検索可能
```
✅ "成田"で検索 → NRTがヒット
✅ "羽田"で検索 → HNDがヒット
✅ "Narita"で検索 → NRTがヒット
```

### 例2: 多言語対応

```mermaid
graph TB
    subgraph "元データ"
        Data[country: "JP"]
    end
    
    subgraph "PropertyResolver"
        subgraph "変換ルール"
            R1[JP → Japan]
            R2[JP → 日本]
            R3[JP → 日本国]
            R4[JP → Japon]
            R5[JP → 일본]
        end
    end
    
    subgraph "検索可能になる"
        S1[🔍 "Japan" ✓]
        S2[🔍 "日本" ✓]
        S3[🔍 "Japon" ✓]
        S4[🔍 "일본" ✓]
    end
    
    Data --> R1 --> S1
    Data --> R2 --> S2
    Data --> R3 --> S2
    Data --> R4 --> S3
    Data --> R5 --> S4
```

### 例3: 駅とバス停の統合検索

#### 問題：異なるデータ形式
```mermaid
graph TB
    subgraph "鉄道データ"
        Train[駅名: "東京"<br/>駅コード: "TYO"<br/>路線: "JR"]
    end
    
    subgraph "バスデータ"
        Bus[停留所: "東京駅前"<br/>系統: "都01"<br/>会社: "都営"]
    end
    
    Problem[❌ 形式が違うので統合検索できない！]
    
    Train --> Problem
    Bus --> Problem
```

#### 解決：PropertyResolverで統一
```mermaid
graph TB
    subgraph "PropertyResolver設定"
        Rule1[駅名 → location_name]
        Rule2[停留所 → location_name]
        Rule3[駅コード → location_code]
        Rule4["東京駅前" → "東京"]
    end
    
    subgraph "統一された形式"
        Unified[location_name: "東京"<br/>location_type: "station/bus_stop"<br/>location_code: "TYO"]
    end
    
    Rule1 --> Unified
    Rule2 --> Unified
    Rule3 --> Unified
    Rule4 --> Unified
    
    Unified --> Search[✅ "東京"で両方検索可能！]
```

### 例4: ショッピングモールの例

```mermaid
graph TB
    subgraph "元データ（バラバラ）"
        Shop1[店舗名: "Starbucks"<br/>階: "1F"<br/>カテゴリ: "CAFE"]
        Shop2[テナント: "ユニクロ"<br/>フロア: "2"<br/>業種: "衣料"]
        Shop3[name: "Apple Store"<br/>level: "Ground"<br/>type: "Electronics"]
    end
    
    subgraph "PropertyResolver"
        R1[店舗名/テナント/name → shop_name]
        R2[階/フロア/level → floor]
        R3[CAFE → カフェ]
        R4[衣料 → ファッション]
        R5[Electronics → 家電]
    end
    
    subgraph "統一後"
        Result[すべて同じ形式で検索可能！<br/>🔍 "カフェ" → Starbucks<br/>🔍 "2階" → ユニクロ<br/>🔍 "家電" → Apple Store]
    end
    
    Shop1 --> R1 --> Result
    Shop2 --> R1 --> Result
    Shop3 --> R1 --> Result
```

---

## よくあるパターン集

### パターン1: 階層的な地域データ

```mermaid
graph TB
    subgraph "📦 地域統計プロジェクト"
        subgraph "階層構造"
            Country[🗾 日本<br/>Shape]
            Prefecture[🏛️ 都道府県<br/>Shape]
            City[🏘️ 市区町村<br/>Shape]
            Station[🚉 駅<br/>Location]
        end
        
        subgraph "統計データ"
            Population[👥 人口<br/>Spreadsheet]
            Income[💰 所得<br/>Spreadsheet]
        end
        
        subgraph "Styler"
            ColorCode[🎨 人口密度で色分け]
        end
    end
    
    Country --> Prefecture
    Prefecture --> City
    City --> Station
    
    Population --> ColorCode
    ColorCode --> City
```

### パターン2: 時系列データの管理

```mermaid
graph LR
    subgraph "📦 成長記録プロジェクト"
        Y2020[📅 2020年<br/>店舗位置]
        Y2021[📅 2021年<br/>店舗位置]
        Y2022[📅 2022年<br/>店舗位置]
        Y2023[📅 2023年<br/>店舗位置]
    end
    
    Y2020 --> Diff1[増加分]
    Y2021 --> Diff1
    Y2021 --> Diff2[増加分]
    Y2022 --> Diff2
    Y2022 --> Diff3[増加分]
    Y2023 --> Diff3
    
    Diff1 & Diff2 & Diff3 --> Analysis[📈 成長分析]
```

### パターン3: マルチソース統合

```mermaid
graph TB
    subgraph "データソース"
        OSM[OpenStreetMap]
        Gov[政府オープンデータ]
        Company[自社データ]
    end
    
    subgraph "📦 統合プロジェクト"
        Locations[📍 全地点データ]
    end
    
    subgraph "PropertyResolver"
        Normalize[正規化<br/>重複除去<br/>名寄せ]
    end
    
    OSM --> Normalize
    Gov --> Normalize
    Company --> Normalize
    Normalize --> Locations
    
    Locations --> Clean[✅ クリーンな統合データ]
```

### パターン4: 条件付き表示

```mermaid
graph TB
    subgraph "📦 店舗管理プロジェクト"
        AllStores[全店舗<br/>1000店]
    end
    
    subgraph "PropertyResolver + 条件"
        Cond1[売上 > 1億円]
        Cond2[営業年数 > 5年]
        Cond3[エリア = 関東]
    end
    
    subgraph "表示結果"
        Large[🔴 大規模店<br/>50店]
        Old[🔵 老舗店<br/>200店]
        Kanto[🟢 関東店<br/>300店]
    end
    
    AllStores --> Cond1 --> Large
    AllStores --> Cond2 --> Old
    AllStores --> Cond3 --> Kanto
```

---

## まとめ：ProjectとPropertyResolverの関係

```mermaid
graph TB
    subgraph "入力"
        Data1[データA<br/>形式X]
        Data2[データB<br/>形式Y]
        Data3[データC<br/>形式Z]
    end
    
    subgraph "📦 Project"
        subgraph "PropertyResolver"
            Transform[🔄 変換・統一]
        end
        
        subgraph "統合データ"
            Unified[統一形式]
        end
    end
    
    subgraph "出力"
        Search[🔍 横断検索]
        Visual[🗺️ 統合表示]
        Analysis[📊 分析]
    end
    
    Data1 --> Transform
    Data2 --> Transform
    Data3 --> Transform
    
    Transform --> Unified
    
    Unified --> Search
    Unified --> Visual
    Unified --> Analysis
```

### 覚えておくべきポイント

1. **Project** = データをまとめる箱
2. **PropertyResolver** = データを変換・つなぐ翻訳機
3. **組み合わせ** = 異なるデータを統合して価値を生む

### 次のステップ

- 実際にProjectを作ってみる
- PropertyResolverで変換ルールを設定してみる
- 複数のデータを組み合わせて地図を作成してみる

---

## FAQ

### Q: ProjectとFolderの違いは？
**A:** 
- Folder = ただの整理用の箱（ファイルフォルダと同じ）
- Project = データを統合・連携させる賢い箱

### Q: PropertyResolverは必須？
**A:** 必須ではありませんが、使うと：
- 異なるデータを簡単に連携
- 多言語検索が可能に
- データの価値が大幅アップ

### Q: 1つのProjectにいくつまでデータを入れられる？
**A:** 制限はありませんが、管理しやすさを考えると：
- Location: 10個程度
- Route: 5個程度  
- Shape: 5個程度
が目安です。