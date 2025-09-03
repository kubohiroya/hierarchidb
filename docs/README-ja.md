@hierarchidb/check-deps について（日本語）

このパッケージは、モノレポにおける依存関係/TypeScriptポリシーを「条件（属性）と理由」で表現し、常に“なぜ”を出力できるようにする薄いチェッカーです。

なぜ作るのか
- 既存ツールは「何が間違っているか」を強く検出できます（循環、未宣言依存、exportsの不備等）。一方で、各リポジトリ固有の「なぜこのルールを守りたいのか（理由）」を政策的に表明し、違反時にレビュアーへ伝える仕組みは弱めです。本ツールは以下を補います。
  - ルールを“パッケージ名の羅列”ではなく“属性（例: UI かつ publishable）”の条件で宣言
  - すべての指摘に「Because: <理由>」を付与し、レビュー/リファクタの文脈を共有
  - 既存ツールで手薄な領域（tsup external と peerDependencies の整合、skipLibCheck の統制、tsconfig 基準）をカバー

どんな場合に有効か
- UI パッケージが React/MUI/Emotion をバンドルせず、ホストアプリの単一インスタンス（peer）に依存させたい
- tsup バンドルで external と peerDependencies を揃え、二重バンドルを防止したい
- すべての公開パッケージに tsconfig の基準（ベース継承、../src 直参照の禁止）を当てたい
- skipLibCheck の暫定的使用を“理由つき”で管理し、恒常化を防ぎたい
- 違反時に「なぜ」そのルールがあるのかを自動で可視化したい

これは何ではないか
- dependency-cruiser / ESLint / publint の代替ではありません。これらと併用してください。
- バンドラや型チェッカーではありません。メタデータ/ファイル構成を読み取り、方針を検証します。

既存ツールとの使い分け
- dependency-cruiser: import 境界・層・循環の規律
- eslint-plugin-import: 未宣言/余分な依存の検出
- syncpack: 依存バージョンの整合
- publint + @arethetypeswrong/cli: 公開パッケージの exports/types 健全性

本ツールは、tsup×peerDependencies 整合、skipLibCheck 統制、tsconfig 衛生、そして“理由つき”報告に専念します。

主な機能
- 属性推論: ui, publishable/private, usesTsup, hasTsx, browser/node, worker, next, storybook, app
- 条件 DSL: all(...), any(...), not(...) と isUI(), isPublishable(), usesTsup() 等
- 理由つき指摘: すべての Finding に「Because: <理由>」を表示
- 型付きポリシー: TypeScript で安全にルール記述
- CLI: hdb-check-deps [--strict]

クイックスタート
1) リポジトリに導入（このリポのようにツール用パッケージとして保持してもOK）。
2) 必要なら、リポジトリ直下に check-deps.config.ts を作成して既定ポリシーを上書き。
3) 実行: hdb-check-deps（--strict で ERROR 時に非ゼロ終了）。

同梱ポリシー（概要）
- UI（公開物）: React/MUI を peer に、バンドル禁止、peer ⊆ tsup.externals を担保
- tsup 利用: peer は external 指定（多重バンドル防止）
- 公開物: tsconfig.base 継承、../src 直参照禁止
- TSX あり: jsx: react-jsx を推奨/要求
- skipLibCheck: 例外許可または理由明示がない限り禁止

詳細は packages/tools/check-deps/src/config.default.ts を参照してください。
