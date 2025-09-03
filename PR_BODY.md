目的
- 仮想モジュール方式（@hierarchidb/tools-vite-plugin-package-reader）を主経路に採用し、ビルド時にプラグイン定義を生成→依存順で自動ロードできるようにしました。
- これに伴い、現行命名規則と不整合な暫定実装（自作の reader / JSON 収集スクリプト）を撤去しました。

変更概要
- app/vite.config.ts: 共有ツールのプリセット（hierarchiDBMultiModulePreset）を導入し、`virtual:plugin-definitions` / `virtual:plugin-map` を生成
- app/src/plugins/auto-load.ts: 仮想モジュールから定義を取得し、`config.dependencies` を用いてトポロジカルソート → 依存順で動的 import
- app/src/types/shims.d.ts: 仮想モジュールの最小型を追加
- app/package.json: devDependencies に `@hierarchidb/tools-vite-plugin-package-reader` を追加
- 削除: scripts/vite-plugin-package-reader.ts, app/scripts/collect-plugins.ts（重複/未配線のため）

背景 / 理由
- 型安全・HMR・依存解決（検出→変換→配布）を1つの Vite プラグインで完結でき、開発体験と保守性が向上
- 現状のパッケージ命名（@hierarchidb/*-plugin）にプリセット側の pattern を合わせ、検出の不一致を解消

受け入れ基準（DoD）
- `pnpm --filter @hierarchidb/app dev` で仮想モジュールが生成され、`auto-load` が依存順でプラグインをロードすること
- 既存 UI のプラグイン参照（SpeedDial 等）が従前どおり動作すること

ロールバック手順
- `app/vite.config.ts` からツールプラグインを外し、旧スクリプトを復帰（このPRで削除した2ファイルを戻す）

補足
- 非Vite文脈向けの JSON スナップショットが必要になった場合は、ツール側の afterTransform フックで出力を追加可能です。
