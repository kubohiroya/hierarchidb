# route ビルド前〜ビルド仕様（2026-02-14 確定）

## 目的

本ドキュメントは、route の pre-build から build/preview までの仕様を定義する。
特に、route 成果物が location 定義に強く依存する点（非レイトバインディング）を明示する。

## 前提: route と location の関係

- route の LineString は、location が提供する始点/終点の緯度経度を入力として生成される。
- このため route 成果物は location 定義に従属し、location 変更の影響を受ける。
- location と route は保存先 DB が異なるため、Dexie transaction で厳密な原子性は保証しない。
- 非原子的更新により route が stale になることを許容し、事後検出で運用する。

## Step3: 国×交通モードフィルタ（selectedArrayByCountries）

### UI 仕様

- 縦軸: 国名
- 横軸:
  - OR 条件（始点または終点が一致）: 空路 / 海路 / 高速鉄道 / 在来線鉄道 / 道路
  - AND 条件（始点かつ終点が一致）: 空路 / 海路 / 高速鉄道 / 在来線鉄道 / 道路
- 1 国あたり 10 チェックボックスを持つ。

### 初期状態

- Step2 で読み込んだデータに存在する「国×交通モード」だけチェックボックスを生成する。
- 生成されたチェックボックスは初期状態で `checked` とする。

### OR/AND 連動

- 同一行で OR 側をチェックした交通モードは、同モードの AND 側を自動で `checked/disabled` にする。
- OR 側が外れた場合は、AND 側の `disabled` を解除する（AND 側の最終状態はユーザー操作を反映）。

### state 更新

- Step3 の操作結果は `selectedArrayByCountries` に反映する。
- Step5 の fetch 対象は `selectedArrayByCountries` を唯一の選択入力として扱う。

## Step4: Build 設定

- shape の build 設定 UI を route でそのまま再利用する。
- 範囲・単位・デフォルト値・ズーム帯適用ルールは原則 shape と共通。
- VT 設定カードも shape と共用する。
- 将来拡張として OSRM Route API / searoute-js の追加パラメータを導入可能にする。

## Step5: Build

### UI/制御

- build ステップの UI 構成と動作は shape と基本的に同一とする。
- 実装は最大限共用し、route 固有差分のみ差し込む。

### 内部パイプライン

- fetch ステージ:
  - shape と同様にデータソースごとの strategy pattern で実装を切り替える。
  - 交通モードに応じた LineString GeoJSON を生成する。
  - `featureCache` には「オリジナル 1 本のみ」の LineString GeoJSON を保存する。
    - shape のようなズーム帯別 GeoJSON コピーは作成しない。
- transform ステージ:
  - route では filtering と simplification を一括で実行する。
  - simplification algorithm と tolerance の単位は shape transform と共通。
  - shape との差分は、shape が fetch 終端で filtering していた点のみ。
- VT ステージ:
  - shape と完全に同じ処理を利用する。

### fetch キャッシュキー

- キーは `<交通モード> + <start/end 正規化座標>` で構成する。
- 正規化座標は `(lon,lat)` タプルで比較し、昇順ソートしてから連結する。
- 双方向経路は同一キーに正規化される。

例:

```text
<mode>:<min(lon,lat)>|<max(lon,lat)>
```

### metadata 保存

- route metadata には以下を保存する:
  - location からコピーした始点/終点座標
  - 始点/終点の admin0〜2 の name/code
  - 始点終点間の距離
  - 中継点数

## Step6: Preview

- shape/location の preview と基本的に同じ UI 構成を利用する。
- FloatingWindow で以下を重ね表示できる:
  - Metadata: routes
  - 交通モード表示トグル
  - スタイル設定
- 交通モードは 5 アイコンボタンの複数 on/off トグルとする（location の表示種別トグルと同様）。
- 保存先は shape と同様の FloatingWindow 永続化（位置・サイズ・モード）を使う。

## location 変更時の波及仕様

### location 行削除

- 対象 location 行がいずれかの route から参照される場合、location UI で警告ダイアログを表示する。
- 選択肢:
  - 参照 route をカスケード削除して続行
  - キャンセル

### location 行更新

- 対象 location 行が参照中の場合、警告ダイアログを表示する。
- 選択肢:
  - 参照 route をカスケード更新して続行
  - キャンセル
- カスケード更新対象は「同一始点終点を参照する全 route ノード」とする。

### プロパティ別の更新ルール

- 始点/終点の座標変更または admin code 変更:
  - 該当 route ノードで該当経路の fetch キャッシュを削除
  - route UI に `rebuild required` タグを表示
  - sessions に「再ビルド予約」項目を作成
    - 予約は route ノード単位でまとめる（経路単位では作らない）
- それ以外（admin name など）:
  - 対応 route metadata を即時更新

## stale 判定と整合チェック

- stale 判定に使う比較項目は次のセット:
  - 座標
  - admin code
  - admin name
- Metadata は通常、保持中の値を受動表示する。
- ただし Step6 の `Metadata: routes` 右上に、route ノード全体を対象にした手動整合チェックボタンを置く。
- 整合チェック結果は次を表示する:
  - `✅同期済み(件数)`
  - `⚠️更新が必要(件数/全体件数)`
- stale 判定は自動では行わず、手動ボタンで実行する。
