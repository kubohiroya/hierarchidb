# Shape: Graph/Transform分割を入れた5ステージ化プラン（ドキュメント）

以下は、shape の現行 `fetch -> transform -> vt` を、境界整合と品質制御を前提にした5ステージ設計に拡張するための運用図です。

### 全体フロー

```mermaid
flowchart TD
  A[BuildSession開始 ShapePipeline.runPipeline] --> B[Stage0 Metadata warmup]
  B --> C{BuildContinuation}
  C -->|続行| B1[既存メタデータ再利用]
  C -->|初回| B2[Metadata fetch update]
  B1 --> S1[Stage1 Fetch]
  B2 --> S1
  S1 --> S2[Stage2 Graph Index]
  S2 --> S3[Stage3 Transform1]
  S3 --> S4[Stage4 Transform2]
  S4 --> S5[Stage5 VT]
  S5 --> S6[Sync Guard 終端 and Cleanup]
  S6 --> Z[Done]

  U[UI status 進捗監視] -->|stage1| S1
  U -->|stage2| S2
  U -->|stage3| S3
  U -->|stage4| S4
  U -->|stage5| S5
```

### Stage1 Fetch

```mermaid
flowchart LR
  subgraph S1[Stage1 Fetch
  plugins/shape-plugin/src/services/vt/shapePipelineFetchStage.ts]
    direction TB
    S1in[Guard Fetch入: stage有効かつ続行可]
    S1t1[FetchTaskを国単位で生成
  shapePipelineFetchStage]
    S1t2[runStageTasks stage fetch
  shapeFetchStage]
    S1f[Fork fetch fan-out]
    S1w1[worker0 fetch]
    S1w2[worker1 fetch]
    S1w3[workerN fetch]
    S1j[Join fetch exit
  保存済みバッファ完了]
    S1skip[Skip fetch branch]
    S1out[Guard Fetch出: fetch結果が準備済み]

    S1in -->|true| S1t1 --> S1t2 --> S1f
    S1f --> S1w1 --> S1j
    S1f --> S1w2 --> S1j
    S1f --> S1w3 --> S1j
    S1in -->|false| S1skip --> S1j
    S1j --> S1out
  end

  subgraph WF1[Worker fetch
  plugins/shape-plugin/src/services/vt/shapeFetchStage.ts]
    direction TB
    Gf1[task受信]
    Gf2[createFetchHandler 構築]
    Gf3[データソース戦略生成]
    Gf4[cache lookup]
    Gf5[ヒット時 メタデータを再作成]
    Gf6[ミス時 raw fetch を実行]
    Gf7[GeoJSON or TopoJSON を取得]
    Gf8[zoom band に応じたフィルタ]
    Gf9[FeatureMetadata 永続化]
    Gf10[fetch cache を保存]
    Gf11[stage fetch 完了を返却]

    Gf1 --> Gf2 --> Gf3 --> Gf4 --> Gf5 --> Gf11
    Gf4 --> Gf6 --> Gf7 --> Gf8 --> Gf9 --> Gf10 --> Gf11
  end
```

### Stage2 Graph Index

```mermaid
flowchart LR
  subgraph S2[Stage2 Graph Index
  packages/vt-orchestrator shared]
    direction TB
    S2in[Guard Graph入: fetch完了を受理]
    S2g1[国形状の正規化ロード]
    S2g2[タイル候補計算と逆引き
  tile countries index]
    S2g3[隣接候補選定
  厳密ジオメトリ判定]
    S2g4[境界弧抽出
  coastline and shared borders]
    S2g5[弧ID付与と永続化]
    S2out[Guard Graph出: index・adjacency確定]

    S2in -->|ready| S2g1 --> S2g2 --> S2g3 --> S2g4 --> S2g5 --> S2out
    S2in -->|skip| S2out
  end

  subgraph WG1[Worker Graph index
  packages/vt-orchestrator shared]
    direction TB
    Gg1[Fetch 結果の正規化]
    Gg2[タイル候補の逆引き index 作成]
    Gg3[隣接候補を幾何判定]
    Gg4[境界弧の抽出]
    Gg5[境界弧 ID の割当て]
    Gg6[adjacency を保存]
    Gg7[Graph 出力を返却]

    Gg1 --> Gg2 --> Gg3 --> Gg4 --> Gg5 --> Gg6 --> Gg7
  end
```

### Stage3 Transform1

```mermaid
flowchart LR
  subgraph S3[Stage3 Transform1
  plugins/shape-plugin/src/services/vt/shapePipelineTransformStage.ts]
    direction TB
    S3in[Guard Transform1入: graph対象を採用]
    S3t1[Transform対象タスク展開
  country x zoom band]
    S3t2[候補tolerance初期決定]
    S3t3[再利用可能キャッシュID付与]
    S3f[Fork transform1 fan-out]
    S3w1[worker0 transform1]
    S3w2[worker1 transform1]
    S3w3[workerN transform1]
    S3j[Join transform1 exit]
    S3out[Guard Transform1出: タスクリスト確定]

    S3in -->|true| S3t1 --> S3t2 --> S3t3 --> S3f
    S3f --> S3w1 --> S3j
    S3f --> S3w2 --> S3j
    S3f --> S3w3 --> S3j
    S3in -->|false| S3j
    S3j --> S3out
  end

  subgraph WT1[Worker transform1
  plugins/shape-plugin/src/services/vt/shapePipelineTransformStage.ts]
    direction TB
    Gt1[task受信]
    Gt2[fetch 結果を集約]
    Gt3[country x band でタスクを展開]
    Gt4[再利用判定を実施]
    Gt5[TaskQueue に再計画結果を反映]

    Gt1 --> Gt2 --> Gt3 --> Gt4 --> Gt5
  end
```

### Stage4 Transform2

```mermaid
flowchart LR
  subgraph S4[Stage4 Transform2
  packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts]
    direction TB
    S4in[Guard Transform2入: transform1成功]
    S4t1[境界弧の簡略化
  自己交差と隣接交差の検証]
    S4t2[失敗時リトライ
  strictからrelaxへ]
    S4t3[国ポリゴン再構成
  assembleCountryGeometryFromArcs]
    S4t4[transform cache永続化]
    S4f[Fork transform2 fan-out]
    S4w1[worker0 transform2]
    S4w2[worker1 transform2]
    S4w3[workerN transform2]
    S4j[Join transform2 exit]
    S4out[Guard Transform2出: cache保存済み]

    S4in -->|true| S4t1 --> S4f
    S4f --> S4w1 --> S4j
    S4f --> S4w2 --> S4j
    S4f --> S4w3 --> S4j
    S4in -->|false| S4j
    S4t1 -- fail --> S4t2
    S4t2 --> S4t3 --> S4t4 --> S4j
    S4j --> S4out
  end

  subgraph WT2[Worker transform2
  packages/vt-orchestrator/src/transform/createTransformByBandHandler/execute.ts]
    direction TB
    Gh1[task受信]
    Gh2[band tolerance と fetch cache を取得]
    Gh3[キャッシュ decode とフィルタ]
    Gh4[簡略化と自己交差チェック]
    Gh5[retry が必要なら再試行]
    Gh6[transform cache 永続化]
    Gh7[transform 結果を返却]

    Gh1 --> Gh2 --> Gh3 --> Gh4 --> Gh7
    Gh4 --> Gh5 --> Gh6 --> Gh7
  end
```

### Stage5 VT

```mermaid
flowchart LR
  subgraph S5[Stage5 VT
  plugins/shape-plugin/src/services/vt/shapePipelineVtStage.ts]
    direction TB
    S5in[Guard VT入: transform cache利用可能]
    S5v1[VTタスクをband単位で生成
  buildVtTasks]
    S5v2[createVtHandler from transform cache]
    S5f[Fork vt fan-out]
    S5w1[worker0 vt]
    S5w2[worker1 vt]
    S5w3[workerN vt]
    S5j[Join vt exit]
    S5v3[Tile描画と永続化]
    S5out[Guard VT出: タイル保存完了]

    S5in -->|true| S5v1 --> S5v2 --> S5f
    S5f --> S5w1 --> S5j
    S5f --> S5w2 --> S5j
    S5f --> S5w3 --> S5j
    S5in -->|false| S5j
    S5j --> S5v3 --> S5out
  end

  subgraph WV1[Worker vt
  packages/vt-orchestrator/src/vt/vtStageHandler.ts]
    direction TB
    Gv1[task受信]
    Gv2[前処理を準備]
    Gv3[bufferIds の collect]
    Gv4[tiling で tile を構築]
    Gv5[tileWriter へ保存]
    Gv6[task 結果を返却]

    Gv1 --> Gv2 --> Gv3 --> Gv4 --> Gv5 --> Gv6
  end
```

### 5ステージ化のための置換

- Stage0/Metadata: `shapePipeline.ts` 冒頭・`runShapeMetadataStage`
- Stage1/Fetch: `runShapeFetchStageSection` と `shapeFetchStage`
- Stage2/Graph Index: 新規導入
- Stage3/Transform1: `runShapeTransformStageSection` 前半
- Stage4/Transform2: `createTransformByBandHandler`
- Stage5/VT: `runShapeVtStageSection` と `createVtHandler`

### 5ステージ化時のポイント

- 最小工数で進めるなら `runShapeTransformStageSection` を Stage3 と Stage4 へ分割します。
- 並列区間の入出口は `Guard` ノードで明示し、失敗時は最小の再入（Stage4in）へ戻して再試行制御します。
