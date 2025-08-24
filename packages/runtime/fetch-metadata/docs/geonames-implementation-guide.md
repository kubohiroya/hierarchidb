# GeoNames実装ガイド - Locationsデータソース

## 概要
GeoNamesは要求された全ての要件を満たす包括的な地理データベースです。

## データ取得可能性サマリー

### ✅ 完全対応項目

| 項目 | GeoNamesでの実装 | 備考 |
|------|-----------------|------|
| **国の首都** | feature_code = 'PPLC' | 約250都市、全て識別可能 |
| **Admin Level 1 首都** | feature_code = 'PPLA' | 約3,500都市（州・県の中心地） |
| **Admin Level 2 首都** | feature_code = 'PPLA2' | 約25,000都市（市・郡の中心地） |
| **空港** | feature_code = 'AIRP' | 約45,000空港 + 3,000ヘリポート |
| **港** | feature_code = 'PRT' | 約2,500港 + 5,000マリーナ |
| **鉄道駅** | feature_code = 'RSTN' | 約50,000駅 + 20,000停車場 |
| **英語名** | name/asciiname フィールド | 全エントリで利用可能 |
| **現地語名** | alternatenames テーブル | 主要地点で20言語以上対応 |
| **緯度・経度** | latitude/longitude | WGS84、小数点6桁精度 |
| **高度** | elevation フィールド | 90%以上のカバレッジ |

### ⚠️ 部分対応項目

| 項目 | 制限事項 | 代替案 |
|------|---------|--------|
| **インターチェンジ** | 専用コードなし | 名称フィルタリング（"interchange", "junction"）で抽出可能 |

## 利用可能なID体系

### 1. GeoNames ID（国際標準）
- **形式**: 整数値（例: 3469034）
- **特徴**: GeoNames独自だが、多くのシステムで参照される事実上の標準
- **用途**: プライマリキーとして使用

### 2. 国際標準コード
| 種類 | 対象 | 例 | 取得方法 |
|------|------|-----|----------|
| **ISO 3166** | 国コード | BR, JP, US | country_code フィールド |
| **IATA** | 空港（3文字） | GRU, NRT, LAX | alternatenames (prefix: iata) |
| **ICAO** | 空港（4文字） | SBGR, RJTT, KLAX | alternatenames (prefix: icao) |
| **UN/LOCODE** | 貿易拠点 | BRSAO, JPTYO | alternatenames (prefix: unlc) |
| **Wikidata QID** | 全般 | Q174, Q1490 | alternatenames (prefix: wkdt) |

### 3. 各国独自の行政区画コード
- **Admin1 Code**: 州・県レベルのコード（国により異なる）
- **Admin2 Code**: 市・郡レベルのコード（国により異なる）
- 例: ブラジルのサンパウロ州 = "27"、東京都 = "40"

## 多言語データの取得

### alternatenames テーブルの構造
```sql
alternateNameId | geonameid | isolanguage | alternate_name | isPreferredName | isShortName
123456         | 3469034   | ja          | サンパウロ      | 1               | 0
123457         | 3469034   | zh          | 聖保羅         | 1               | 0
123458         | 3469034   | pt          | São Paulo      | 1               | 0
```

### 主要言語のカバレッジ
- **主要都市**: 20言語以上
- **空港・港**: 10言語以上
- **一般的な駅**: 5言語以上

## 実装手順

### 1. データダウンロード
```bash
# メインデータ（全地点情報）
wget https://download.geonames.org/export/dump/allCountries.zip

# 多言語名称データ
wget https://download.geonames.org/export/dump/alternateNamesV2.zip

# 行政区画コード
wget https://download.geonames.org/export/dump/admin1CodesASCII.txt
wget https://download.geonames.org/export/dump/admin2Codes.txt

# 階層データ（親子関係）
wget https://download.geonames.org/export/dump/hierarchy.zip
```

### 2. データフィルタリング（SQLクエリ例）

```sql
-- 国の首都
SELECT * FROM geonames WHERE feature_code = 'PPLC';

-- Admin Level 1の首都
SELECT * FROM geonames WHERE feature_code = 'PPLA';

-- Admin Level 2の首都
SELECT * FROM geonames WHERE feature_code = 'PPLA2';

-- 空港
SELECT * FROM geonames WHERE feature_code IN ('AIRP', 'AIRH');

-- 港
SELECT * FROM geonames WHERE feature_code IN ('PRT', 'MAR');

-- 鉄道駅
SELECT * FROM geonames WHERE feature_code IN ('RSTN', 'RSTP');

-- インターチェンジ（名称ベース）
SELECT * FROM geonames 
WHERE feature_code = 'RD' 
AND (name LIKE '%interchange%' OR name LIKE '%junction%');
```

### 3. 多言語名称の結合

```sql
-- 日本語名を取得
SELECT g.*, a.alternate_name as japanese_name
FROM geonames g
LEFT JOIN alternatenames a ON g.geonameid = a.geonameid
WHERE a.isolanguage = 'ja' AND a.isPreferredName = 1;
```

### 4. 外部IDの取得

```sql
-- IATA/ICAOコードを持つ空港
SELECT g.*, 
       iata.alternate_name as iata_code,
       icao.alternate_name as icao_code
FROM geonames g
LEFT JOIN alternatenames iata ON g.geonameid = iata.geonameid 
    AND iata.isolanguage = 'iata'
LEFT JOIN alternatenames icao ON g.geonameid = icao.geonameid 
    AND icao.isolanguage = 'icao'
WHERE g.feature_code = 'AIRP';
```

## データ品質

### 座標精度
- **形式**: WGS84測地系
- **精度**: 小数点6桁（約11cm精度）
- **例**: 35.689487, 139.691706（東京駅）

### 高度データ
- **ソース**: SRTM, ASTER GDEM
- **精度**: ±10-30メートル
- **カバレッジ**: 陸地の90%以上

### 更新頻度
- **頻度**: 毎日更新
- **変更数**: 1日平均15,000件以上
- **ソース**: コミュニティ投稿 + 公式ソース

## 推奨実装アプローチ

1. **初回インポート**
   - 必要なfeature_codeのみをフィルタリング
   - 約500,000レコード（全1,180万件中）

2. **インデックス作成**
   - geonameid（プライマリキー）
   - feature_code（タイプ別検索）
   - country_code, admin1_code, admin2_code（地域検索）
   - 空間インデックス（緯度・経度）

3. **定期更新**
   - 日次差分ファイルで更新
   - または週次/月次で全データ再インポート

4. **API統合**
   - GeoNames Web ServiceをフォールバックとしThて使用
   - レート制限: 1時間あたり2000リクエスト（無料版）