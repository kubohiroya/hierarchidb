# TODO-refactoring 2025-10-17

## 背景
- 2024年8月末のプラグインアーキテクチャ刷新で、`PluginDefinition` は Worker 側メタデータへ集約され `components` プロパティは削除済み。
- UI は `virtual:plugin-registry-ui` （Vite 仮想モジュール）経由で `packages/*-plugin/src/ui` エントリを遅延ロードし、副作用でレジストリへ登録する方式へ移行。
- folder-plugin には旧実装（`src/ui/plugin.ts` 等）が残存し、`PluginDefinition` への直接代入で型エラーが発生している。

## 現状整理メモ
- `packages/plugin-sdk/src/types/plugin-definition.ts` では `ui?: { dialogComponentPath?: ... }` といったパス情報のみを保持する想定で、React コンポーネント参照を許容しない。
- `packages/tools/vite-plugin-node-type-registry/src/registry-plugin.ts` が `virtual:plugin-registry-ui` を生成し、`packageName/ui` を import → `HostProfileRegistry` 等の副作用を実行する。
- folder-plugin の `src/ui/index.ts` / `src/ui/components/folder-host.tsx` は新方式に沿っているが、`src/ui/plugin.ts` や `src/ui/components/FolderUIPlugin.tsx` が未整理のまま残っている。

## 直近で着手したいタスク候補
1. ✅ `src/ui/plugin.ts` と `src/ui/components/FolderUIPlugin.tsx` を整理し、互換レイヤーの要否を確認した上で削除。
2. ✅ manifest → build の連携確認（`pnpm --filter @hierarchidb/folder-plugin build`）を実施し、`dist` に出力される `plugin-definition` が想定値か点検。
3. 他プラグイン（shape/location/route 等）で同様の旧 `components` 利用が残っていないか横断調査し、必要なら共通のToDoへ登録する。
   - 2025-10-17 チェック結果: `plugins/shape-plugin/src/common/ui-plugin.tsx` と `plugins/shape-plugin/src/ui/plugin.ts` に旧 `components` マッピングが残存。location/route/styler では該当箇所なし。
   - 2025-10-17 着手: 上記2ファイルを削除し、`src/ui/index.ts` の副作用 import を `./components/steps-provider.js` へ更新。
   - 2025-10-17 `pnpm --filter @hierarchidb/shape-plugin typecheck` 実行結果、UI コンポーネントと services/batch 配下で多数の既存型エラーが顕在化（undefined 耐性、`@hierarchidb/*` 未エクスポート、Node16 path 拡張子など）。build は sandbox の `EPERM` で未完了。追加タスクで段階整備する。

## 注意事項 / オープンな検討点
- 互換目的で `FolderUIPlugin` 参照を外部が要求している場合、`unknown` ベースの薄いラッパーを提供して破壊的変更を避ける案を検討。
- registry への副作用登録順序が依存解決と一致しているか、`virtual:plugin-definitions` の load order を確認してから削除作業を進める。
- cleanup 時は `pnpm --filter @hierarchidb/folder-plugin typecheck` / `build` をセットで回し、ロールバック手順を TASKS.md へ追記する。
