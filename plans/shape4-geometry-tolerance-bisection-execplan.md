# Shape4 Geometry tolerance 再設計を `baseTolerance` 基準へ移行する

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

`PLANS.md` はリポジトリルートに存在し、本計画はその要件に従って維持する。

## Purpose / Big Picture

この変更が完了すると、Shape4 Geometry の頂点上限対策は「増分再試行中心」から「`baseTolerance`（2分法探索）中心」に変わる。利用者は自治体レベルとズームレベルごとに `multiplier/min/max` を調整するだけで、データ複雑性に応じた tolerance が自動推定される。巨大国と小国が混在するケースでも、失敗までの試行回数を減らしつつ `6553` 上限を満たしやすくなる。動作確認は、同一データセットで新旧方式の試行回数・失敗率・最終頂点数を比較して行う。

## Progress

- [x] (2026-03-02 10:40 JST) 新方式仕様書 `docs/spec/shape4-geometry-tolerance-bisection-spec.md` を作成し、アルゴリズム・UI・移行方針を固定した。
- [ ] 既存実装の責務分解（profile 解決、retry 実行、UI 設定保存）を整理し、置換順を確定する。
- [ ] `simplifyProfile` と geometry 設定型に `multiplier/minRatio/maxRatio` を追加し、互換読込を実装する。
- [ ] `createTransformByBandHandler` の retry 方式を `baseTolerance` 探索 + 少回数補正へ置換する。
- [ ] ToneCurveEditor を 3 線（青=multiplier、灰=min、赤=max）へ変更し、`0.0..2.0` 制約を実装する。
- [ ] 新旧比較テスト（unit + integration）を追加し、試行回数削減と頂点上限遵守を検証する。
- [ ] 旧 `retryToleranceByBand/retryCount` の deprecate 手順を適用し、撤去条件を満たしたら削除する。

## Surprises & Discoveries

- Observation: 現行の頂点上限失敗は `retryToleranceSecond` からの指数増加でフィーチャー単位に進むため、データ分布が偏ると試行回数が急増しやすい。
  Evidence: `packages/vt-orchestrator/src/transform/createTransformByBandHandler/transformByBandRetrySimplify.ts` の `nextToleranceValue` 計算と `execute.ts` の feature ループ。

- Observation: UI 設定は既に admin level 単位のタブ構造と `ToneCurveEditor` を持っており、パラメータ意味を差し替えるだけで 3 線化できる。
  Evidence: `plugins/shape-plugin/src/ui/components/build-config/SimplifyToleranceByAdminLevelCard.tsx` が `toleranceByBand` と `retryToleranceByBand` の 2 系列を同時編集している。

## Decision Log

- Decision: `baseTolerance` は Source 統計の最大頂点ポリゴンを代表サンプルにして 2 分法で算出する。
  Rationale: 「最悪ケースを先に抑える」ことで上限超過の再試行を大幅に減らせるため。
  Date/Author: 2026-03-02 / Codex

- Decision: 新 UI は `multiplier/minRatio/maxRatio` の 3 線で統一し、値域を `0.0..2.0` に固定する。
  Rationale: 旧「初期値・増分・回数」より意味が明確で、`t_final = clamp(baseTolerance * multiplier, baseTolerance * min, baseTolerance * max)` を直接表現できるため。
  Date/Author: 2026-03-02 / Codex

- Decision: 旧設定は即時削除せず、互換読込を経て段階撤去する。
  Rationale: 既存保存データとの互換性と運用リスクを確保するため。
  Date/Author: 2026-03-02 / Codex

## Outcomes & Retrospective

- 2026-03-02 時点では設計・計画段階。実装は未着手。
- 今回の成果は、実装時に迷いが出やすい「探索式」「UI 意味」「互換方針」を先に固定した点。
- 次の節目は Milestone 1（設定型と profile 解決の実装）完了時に更新する。

## Context and Orientation

現行の Geometry tolerance 処理は `packages/vt-orchestrator/src/transform/createTransformByBandHandler/execute.ts` を中心に構成される。admin level ごとの tolerance 設定は `helpers/simplifyProfile.ts` が解決し、フィーチャーごとの頂点超過時は `transformByBandRetrySimplify.ts` で再簡略化を繰り返す。UI は `plugins/shape-plugin/src/ui/components/build-config/SimplifyToleranceByAdminLevelCard.tsx` で `ToneCurveEditor` を使い、実質 2 系列（通常 tolerance と retry tolerance）を編集する。

本計画でいう `baseTolerance` は「最大頂点ポリゴンを 6553 以下にする最小 tolerance」を意味する。`multiplier/minRatio/maxRatio` は `baseTolerance` 比の調整値で、最終 tolerance は `clamp` で決定する。ここでの `clamp` は「下限未満なら下限へ、上限超過なら上限へ丸める」処理を指す。

## Plan of Work

最初に設定モデルを更新する。`simplifyProfile` と関連型へ `multiplierByBand/minRatioByBand/maxRatioByBand` を追加し、既存 `toleranceByBand/retryToleranceByBand/retryCount` は互換入力としてのみ扱う。次に Geometry 実行系を置換し、最大頂点ポリゴンから `baseTolerance` を2分法で求める処理を追加する。`baseTolerance` はバンド単位の基準として計算し、個別フィーチャーには複雑性ベース初期推定から少回数補正をかける。

続いて UI を更新し、ToneCurveEditor を 3 線構成へ変更する。ドラッグ制約として `min <= multiplier <= max` と `0.0..2.0` を常時維持する。最後にテストを拡充し、新旧比較で「上限達成率」「試行回数」「失敗時メッセージ」を検証する。互換期間中は旧項目を読み取り可能に保ち、設定保存は新形式を優先する。

## Milestones

### Milestone 1: 設定契約の再定義

`packages/gis-sdk` と `packages/vt-orchestrator` の設定型を更新し、`multiplier/minRatio/maxRatio` を正式項目にする。完了時点で、既存設定を読み込んでもクラッシュせず、新形式へ正規化できる状態にする。

### Milestone 2: `baseTolerance` 探索と Geometry 実行置換

`execute.ts` の頂点超過ハンドリングを再構成し、2 分法探索で求めた `baseTolerance` を基準に処理する。完了時点で、指数的再試行依存を外し、ログへ `baseTolerance` と探索反復情報が残るようにする。

### Milestone 3: ToneCurveEditor 3 線化

`SimplifyToleranceByAdminLevelCard.tsx` を 3 系列編集へ置換し、既存 2 系列 UI を廃止する。完了時点で admin×zoom の調整が `multiplier/min/max` で一貫し、保存データが新形式に統一される。

### Milestone 4: 検証・互換・撤去

新旧比較テストを通して品質と性能を確認し、Issue に結果を記録する。条件が満たされ次第、`retryToleranceByBand/retryCount` を最終撤去する。

## Concrete Steps

作業ディレクトリ: `/Users/hiroya/WebstormProjects/hierarchidb`

1. 既存コード調査
   - `rg -n "retryToleranceByBand|retryCount|MAX_RETRY_ATTEMPTS|DEFAULT_RETRY_VERTEX_LIMIT" packages/vt-orchestrator/src plugins/shape-plugin/src`

2. 設定型の更新と互換正規化
   - 変更対象:
     - `packages/vt-orchestrator/src/transform/createTransformByBandHandler/helpers/simplifyProfile.ts`
     - `packages/vt-orchestrator/src/types/_BuildConfig.ts`
     - `plugins/shape-plugin/src/common/types/build.ts`（必要時）

3. `baseTolerance` 探索の実装
   - 変更対象:
     - `packages/vt-orchestrator/src/transform/createTransformByBandHandler/execute.ts`
     - 必要なら `helpers/` へ `bisectionTolerance.ts` 追加

4. UI 3 線化
   - 変更対象:
     - `plugins/shape-plugin/src/ui/components/build-config/SimplifyToleranceByAdminLevelCard.tsx`
     - `plugins/shape-plugin/src/ui/locales/{ja,en}.json`

5. テスト追加
   - 変更対象候補:
     - `packages/vt-orchestrator/src/transform/__tests__/...`
     - `plugins/shape-plugin/src/ui/__tests__/...`

6. 検証
   - `pnpm -w turbo run build --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin`
   - `pnpm -w turbo run typecheck --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin`
   - `pnpm -w turbo run test --filter @hierarchidb/vt-orchestrator --filter @hierarchidb/shape-plugin`

## Validation and Acceptance

受け入れは次の観測で判断する。

- 同じ入力データで、旧方式より平均試行回数が減少する。
- 失敗ケースでもエラーに `baseTolerance/finalTolerance/vertexLimit` が含まれる。
- UI が 3 線表示になり、`min <= multiplier <= max` 制約が常時成立する。
- 既存保存データを読み込んでも設定画面が壊れず、新形式へ保存し直せる。

## Idempotence and Recovery

この移行は段階適用する。各マイルストーンごとにコミットし、問題があれば直前コミットへ revert して旧方式に戻せる。互換期間は旧設定の読み取りを維持するため、途中で再実行してもデータ破壊は発生しない。重大障害時は新方式の feature toggle を OFF にして即時切戻し可能な状態を維持する。

## Artifacts and Notes

実装時には Issue #675 に以下を記録する。

- 新旧比較の試行回数・失敗率サマリ
- `pnpm` 検証コマンドの exit code
- 互換期間中に残す項目と削除予定時期

## Interfaces and Dependencies

主要依存は既存の `@hierarchidb/vt-orchestrator`, `@hierarchidb/gis-sdk`, `@hierarchidb/ui-tone-curve-editor` で、新規外部ライブラリは追加しない。最終的に必要なインターフェースは次の通り。

- `resolveSimplifyToleranceProfile(...)` が `multiplier/minRatio/maxRatio` を返せること。
- Geometry 実行が `baseTolerance` 探索結果を受け取り、`t_final` を算出できること。
- UI から admin×zoom ごとの 3 系列を保存・復元できること。

Change log: 2026-03-02 初版作成。新方式仕様と実装順を固定するために追加。
