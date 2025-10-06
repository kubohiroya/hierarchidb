## ToDo

1. 共通バッチ API の横展開整理
   - UnifiedLocationBatchManager で得た知見を Shape/Route 他プラグインへフィードバック
   - WorkerBridge/BatchProgress のエラーハンドリングと型を横断的に統一

2. PluginDialogFooter & Start Batch ボタン運用の共通化
   - LocationDialog で追加する Start Batch ボタン仕様を基に、各プラグインのフッター表示条件・文言を整理
   - PluginDialogFooter の API ガイドラインを更新し、利用側の回収を進める

3. バッチ進捗 UI コンポーネントの再利用化
   - useLocationProgress の拡張をテンプレート化し、Shape/Route 等と共有できる Progress Panel を作成
   - Progress 表示のステージ定義・通知メッセージを共通化

4. 行政区マスター／トポロジ参照ユーティリティの整理
   - gid0/gid1/gid2 付与ロジックに合わせて共通マスターの取得・キャッシュ戦略を見直し
   - Shape/Route など地理系プラグインでも使えるユーティリティパッケージ化を検討

5. Route ↔ Location 連携仕様の実装着手
   - LocationPoint 型／Dexie スキーマへ `locationCode` & `treeNodeId` 必須を反映し、ユニットテストを追加
   - RouteEntity/WorkingCopy を locationCode ベースへ再設計し、既存データのマイグレーション方針を策定
   - データソースストラテジを再実装（locationCode 抽出・座標一致検証・経路属性生成）し、docs/plugins/route-location-integration.md の内容を DoD に沿って落とし込む

6. Location ↔ Shape 行政区画連携の実装
   - LocationPoint に `gid0/gid1/gid2` など行政区画コードを追加し、resolver-plugin を用いたコード変換テーブルで任意体系に対応、Dexie インデックスも整備
   - ShapeArea PersistentGroupEntity と Dexie DB を新設し、行政区画コードとベクトルタイル参照情報（タイル ID／ズーム／feature ID など）を保存する
   - 行政区画コードをキーに LocationPoint ↔ ShapeArea を横断検索できる API/テストを実装し、仕様を docs/plugins/route-location-integration.md に反映

## Doing（進行中）

1. LocationStep ステッパー導入&配線
   - Location Dialog の 4 ステップ化（Details/Selection/Preview/Confirm）に合わせ、2ステップ構成アプリとの乖離を埋める
   - 現状: ステップコンポーネントのドラフト差し替えが途中（SelectionStep/PreviewStep が route 仕様流用）
   - 次のアクション: i18n の整理とテスト差し替え（SelectionStep の `SelectionMatrix` がドラフト仕様のまま）
   - ロールバック: `packages/plugins/location-plugin/src/components/steps/` 差分と `LocationDialog.tsx` を revert

2. UnifiedLocationBatchManager の API 固定（仮差し戻し状態）
   - Location plugin のバッチ導線で利用中の API が Breaking になっており、shape/route 未対応
   - 現状: バッチセットアップの方針書き換え途中で開発一時停止
   - 次のアクション: `UnifiedLocationBatchManager` の API 設計を確定し、呼び出し側を順次更新
   - ロールバック: `services/batch/UnifiedLocationBatchManager.ts` の差分を revert
