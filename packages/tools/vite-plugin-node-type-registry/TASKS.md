# vite-plugin-node-type-registry — タスクメモ

## 修正するべきファイルと箇所
- `app/vite.config.ts`
  - 新プラグインの登録処理へ切り替え。既存の `vite-plugin-registry` / `vite-plugin-services` を外し、新しい統合プラグイン + alias 設定を組み込む。
- `app/src/config/plugin-registry.ts`（存在する場合）
  - 仮想モジュール import パス (`virtual:plugin-registry-*`) の新命名へ更新。
- `app/docs/16-plugin-dev-with-registry.md`
  - 開発手順・ロールバック手順を新プラグイン向けに書き換え、削除した旧パッケージへの言及を整理。
- `pnpm-workspace.yaml` / ルート `package.json`
  - 新パッケージの workspace 登録と依存追加、旧パッケージの削除。
- `tsconfig.*.json`（アプリ/ワークスペース）
  - `paths` などで旧ユーティリティに依存している場合、新しい alias 同期フローへ引き直す。

## 削除するファイル・ディレクトリ
- `app/vite-plugin-registry.ts`
  - 既存の UI/Worker 向け仮想モジュール生成ロジック。本パッケージへの移行後は逆参照が無くなるため撤去対象。
- `app/vite-plugin-services.ts`
  - サービス向け仮想モジュール生成とデバッグ出力処理を内包。本パッケージが提供する統合プラグインで代替する。
- `packages/tools/plugin-registry-utils`
  - nodeType アライメント用ユーティリティ。新プラグインに検出・エイリアス同期機能を統合した段階で不要になる。
- `packages/tools/vite-plugin-package-reader`
  - 旧ジェネリック実装。本パッケージ完成後は依存を切り替え、ディレクトリごと削除する。

削除・修正はいずれも新プラグイン組み込みと検証（型チェック・テスト・Dev サーバー実機確認）が完了した段階で実施すること。
