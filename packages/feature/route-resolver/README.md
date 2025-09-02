@hierarchidb/route-resolver
===========================

このパッケージは「仕様のみ」を提示します（現時点で実装は行いません）。

目的
----
- WebGPU を用いた all-pairs shortest path（APSP）計算機能を提供し、大規模グラフの最短路情報を高速に前計算/逐次更新する。
- searoute（海路）や地上経路、プラグイン内のルーティングに横断的に使える「解決器（resolver）」を feature として分離する。

対象とゴール
------------
- 入力: 重み付きグラフ（有向/無向、非負エッジ重み）。
  - Node集合: 最大O(10^4〜10^5)を想定（段階的拡張）。
  - Edge集合: 疎グラフ〜中規模密グラフの両方を許容（ブロック分割で対応）。
- 出力: 以下のいずれか/複数
  - 距離行列（圧縮/分割保存）
  - 前駆行列（reconstruct用に最小限の predecessor/nextHop）
  - 任意ペアの経路復元（segment id 列）のための nextHop テーブル
- パイプライン: WebGPU核（WGSL）で計算 → 分割結果をDexie/IndexedDBに保存 → resolver APIで問い合わせ。

ユースケース
------------
- searoute（海路）: 港・海峡・グリッドの簡略化グラフに対してAPSPを事前計算し、任意の2港間のルート応答を高速化。
- route-plugin: 都市/道路グラフでのルート探索をキャッシュ/前計算して高速に返す。
- 実時間制約のあるUI: 「距離/所要時間ヒートマップ」「最寄り拠点検索」などを即応。

計算モデル（案）
----------------
1) Floyd–Warshall（FW）GPU化
   - ブロック分割（blocked FW）でタイルを shared memory に載せて反復（kブロック→行ブロック→列ブロック）。
   - O(n^3) だがブロック/タイル戦略で WebGPU メモリ階層を活用。 n が大きい場合は部分行列/部分ノード集合で分割計算。

2) Multi-source Dijkstra（MSD）GPU化
   - 疎グラフ向け。複数ソースを並列に処理し、距離を段階緩和（Δ-stepping などの並列Dijkstra変種）。
   - 実装方針: バケット/キューをバッファ管理。エッジリストCSR表現で訪問/緩和。

3) ハイブリッド
   - 小規模〜中規模密→FW、疎/巨大→MSD（分割）を選択。閾値・ヒューリスティックは統計で自動判別。

データ表現/入出力
------------------
- 入力（GraphPort）
  - CSR/CSC/COO いずれかを受け取り、GPU側に転送可能な連続バッファへ変換。
  - ノードID→インデックス写像（辞書）を付帯。
- 出力（StorePort）
  - 距離ブロック: (iBlock, jBlock) 単位で IndexedDB/Dexie に保存（可逆なブロック座標）
  - nextHop/前駆: メモリ効率の良い符号化（8/16/32bit幅を可変）
  - メタデータ: n, m, blockSize, algo, version, checksum

API（抽象I/F案）
-----------------
- ResolverService
  - `runAPSP(graph: GraphPort, opts) -> OperationHandle`
  - `getStatus(opId) -> { progress, stage, eta }`
  - `cancel(opId)`
  - `queryDistance(a, b) -> number | undefined`
  - `queryPath(a, b) -> string[]`（nextHop復元）
- Ports
  - GraphPort: ノード/エッジ列挙・CSR取得・ノード辞書
  - StorePort: 距離/nextHopのブロック保存・取得
  - GPUPort: デバイス獲得/バッファ確保/カーネル起動（内部抽象）

WebGPU要件/設計注意
-------------------
- Cross-origin isolation（COOP/COEP）とアダプタ検出。未対応環境ではCPU/WASMフォールバック（別パッケージ想定）。
- WGSLカーネルはタイルサイズ/ローカルワークグループを可変に（デバイスに最適化）。
- 浮動小数精度: 32bit float 前提。重みのスケーリング/固定小数化の検討。

性能とメモリ
------------
- n=10k のFWは O(10^12) で現実的でないため、FWは n≲2k 程度の密グラフ or 分割/階層化に限定。
- 疎大規模はMSD系（Δ-stepping）で分割し、各ソースをバッチに分けて計算。チェックポイント/再開（batch連携）。

統合ポイント
------------
- searoute（海路）: 事前APSPにより任意2港間の問い合わせを O(1)〜O(log n) で応答（nextHop参照）。
- route-plugin（地上）: 道路網や行政区グラフにも適用。距離/時間の拡張は Store メタで管理。
- download/CAS: グラフデータの取得/重複管理は @hierarchidb/download と連携可。

段階的実装計画
----------------
1) 仕様凍結（本ドキュメント）
2) API/Portsの型定義（GraphPort/StorePort/ResolverService、GPU検出）
3) 小規模FWのWGSL版PoC（n≲512）とブロック化
4) 疎向けMSD（Δ-stepping）PoCとCSR最適化
5) Dexieブロック保存 + queryDistance/queryPath の復元I/F
6) ベンチ/チューニング（ブロック/ワークグループ/メモリ転送）

非機能要件
----------
- 安定API（v0.1）を守り、GPU未対応環境へはフォールバック方針を併記。
- 大量メモリ/長時間実行に対するキャンセル/再開フックを用意（batch/compute連携）。

備考
----
- 実装フェーズで、WGSLカーネル・CSR変換・ブロックI/Oのリファレンスを追加予定。

