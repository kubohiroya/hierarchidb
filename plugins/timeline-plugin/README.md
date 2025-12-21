# @hierarchidb/timeline-plugin

Projects ツリーにおける「特殊なフォルダ」型ノードとしての Timeline プラグインのスケッチ実装です。Timeline は自分の配下（子孫）に folder / linker / timeline を含む任意ノードを持てます。配下のノード列を時間軸のフレームとして扱い、最終的に地図アニメーションとして閲覧します。

本 README は、これまでの要件・議論内容をもとにした目的/機能/使い方の初期設計をまとめたものです。実装はプレースホルダと最小 UI を含む段階で、今後の拡張を前提としています。

---

## 目的（Purpose）

- Projects ツリーに「Timeline」ノードを追加し、配下の子孫ノードを時間軸のフレームとして並べ、地図上でアニメーション再生する。
- Timeline/Linker はいずれも「特殊なフォルダ」として扱い、folder/linker/timeline を子として持てる柔軟な構造を許容する。
- UI ダイアログで、基本情報入力 → フレーム確認 → 地図プレビュー → 完成アニメーション閲覧という流れをガイドする。

## 機能（Features）

- Special folder capabilities
  - canHaveChildren: true（子を持てる）
  - canBeRoot: false（ルートにはならない想定）
  - ツリー/コンテキストメニュー上は「特殊フォルダ」扱い（将来的には専用アイコン/色を適用）
- ダイアログ（4 ステップ）
  1) Basic Information: name / description の入力
  2) Frames Preview: タイムラインノードの子孫をフラット化し、名前順で並べるプレビュー（1 行 = 1 フレーム）
  3) Map Preview: 地図の簡易プレビュー＋時間軸スライダー。スライダー位置でフレームを切り替え
     - Auto モード（ミニ UI）: fps 入力、ループ切替
  4) Final Animation: 再生/一時停止・前後・スライダー・fps・ループの最終プレビュー
- フレーム操作ユーティリティ
  - useFramePlayer: fps/loop/再生制御・next/prev/seek を提供
  - toFramesFromNodes: TreeNode[] を {id,name}[] に整形し、名前順で返却

## 使い方（Usage）

### 前提
- 本リポの app を開発モードで起動します。
  - `pnpm -C app dev`
- app 側では `@hierarchidb/runtime-shared-module-paths.importPluginWorker('timeline')` を通じて `@hierarchidb/timeline-plugin/worker` を遅延ロードします。
  - app/src/worker-runtime/WorkerModuleLoader.ts で timeline の登録を確認してください
- Projects の「作成」メニューに timeline/linker を表示する設定を追加済みです。
  - app/src/plugins/menu-spec.ts の projects.order に `timeline`, `linker` を追記

### Projects ツリーからの作成フロー
1. Projects ツリーで「作成」→「Timeline」を選択
2. Worker 経由で draft Working Copy を作成（内部的に `createNode({ nodeType:'timeline' ...})`）
3. ルーティング `/t/:treeId/:pageNodeId/:wcNodeId/timeline/create` へ遷移
4. Timeline ダイアログ（4 ステップ）が開き、設定/確認/プレビューを行う
5. Finish で保存（将来: Working Copy を commit）し、保存先ノードへ遷移

### ダイアログの構成（アプリから直接使う場合）
- パッケージから UI ステップを直接 import できます（自主的な組み合わせも可能）。

```tsx
import {
  BasicInfoStep,
  FramesPreviewStep,
  MapPreviewStep,
  AnimationViewerStep,
  toFramesFromNodes,
} from '@hierarchidb/timeline-plugin/ui';

// 例: frames 整形
const frames = toFramesFromNodes(descendants); // [{id,name}] に整形

// 例: 任意の PluginDialog に組み込み
```

- 本パッケージは `TimelineDialog` も提供します（MUI Dialog + Stepper の簡易版）。

```tsx
import { TimelineDialog } from '@hierarchidb/timeline-plugin/ui';

<TimelineDialog
  mode="create"
  parentId="p:123"
  open={open}
  onClose={() => setOpen(false)}
  onSuccess={(savedNodeId) => navigate(`/t/${treeId}/${pageNodeId}/${savedNodeId}`)}
/>
```

> 備考: app では `PluginDialogRoute` が `getDialogComponent()` を自動検出してダイアログを起動します。

### フレームの取得（将来の統合）
- QueryAPI 経由で timeline ノードの子孫を取得し、`toFramesFromNodes` に渡してフレーム化します。

```ts
const descendants = await query.listDescendants(timelineNodeId);
const frames = toFramesFromNodes(descendants);
```

## 実装メモ（Implementation Notes）

- パッケージ構成
  - `src/worker/` … timeline の lifecycle を export（特殊フォルダとしての能力）
  - `src/ui/steps/` … 4 ステップの UI コンポーネント
  - `src/ui/utils/` … useFramePlayer / frames 整形ユーティリティ
  - `src/ui/TimelineDialog.tsx` … MUI Dialog ベースの簡易ウィザード
- app への組込み
  - Worker ローダ: `await import('@hierarchidb/runtime-shared-module-paths').then((m) => m.importPluginWorker('timeline'));`
  - 作成メニュー: `menu-spec.ts` に `timeline` を追加済み
- アイコン
  - MUI: Timeline（@mui/icons-material/Timeline）
  - app では icon prefetch をガード済み（未導入でも落ちない）。

## 制約・今後の拡張（Roadmap）
- MapPreview はプレースホルダ。@hierarchidb/ui-map を統合し、frames[index] に応じたレイヤの切替・スタイル反映を実装予定。
- 保存フロー（Working Copy の commit）や Validation の詳細は今後詰める。
- Linker プラグインは Projects ツリーの「特殊フォルダ」として枠のみ追加。別パッケージで実装予定。
- Projects ツリー UI での「特殊フォルダ」表示（色分け/バッジ）を追加予定。

## 開発（Development）
- ビルド/型チェック
  - `pnpm -C packages/plugins/timeline-plugin build`
  - `pnpm -C packages/plugins/timeline-plugin typecheck`
- 開発中の app 起動
  - `pnpm -C app dev`
