# dep-fence 本家取り込みガイド（このリポで作成した成果物の受け渡し）

この文書は、隣で dep-fence の本家リポジトリを更新しているエージェント向けの統合ガイドです。
ここで用意した「カスタムルール（提案）」と「設定項目」を dep-fence 本体に取り込むための手順・API設計・テスト方針をまとめています。

対象成果物（本リポ内の提供ファイル）
- ルール実装（PR 素材）
  - `scripts/dep-fence-rules/maplibre-allowlist.mjs`
  - `scripts/dep-fence-rules/ui-peer-policy.mjs`
  - ルール設計の README: `scripts/dep-fence-rules/README.md`
- 利用側の設定例（参考／使用者側）
  - `dep-fence.config.mjs` の追加エクスポート例
    - `export const policyOptions = { ... }`
    - `export const pruneIgnore = [...]`
    - `export const pruneIgnoreByPackage = { ... }`

取り込みのゴール
- dep-fence 本体に「汎用カスタムルール」として以下を追加：
  - Rule E: maplibre-allowlist — 特定パッケージのみが MapLibre 系依存（maplibre-gl / @vis.gl/react-maplibre）を直接持てる
  - Rule F: ui-peer-policy — UI 基盤（react, react-dom, @mui/*, @emotion/* 等）は dependencies ではなく peerDependencies
- ルールの API を dep-fence のルールモデルに沿って定義し、ルール登録（rules registry）とドキュメントを追加
- フィクスチャ・ユニットテストを追加

推奨 Rule API（dep-fence 本体側の想定）
- 既存 dep-fence のポリシー定義に合わせつつ、ルールプラグインの最小 API を以下とします：
  - `id: string`
  - `meta: { docs?: string }`
  - `create(options): (ctx) => void`
  - ctx には少なくとも以下が必要：
    - `pkg`: パッケージの `package.json` オブジェクト
    - `dir`: パッケージのディレクトリパス
    - `report(violation)`: 違反通知（`{ message, severity: 'ERROR' | 'WARN', where?: string }`）

サンプル実装（提案ルールの移植元）
1) maplibre-allowlist
- 出所: `scripts/dep-fence-rules/maplibre-allowlist.mjs`
- 目的: MapLibre スタック（`maplibre-gl`, `@vis.gl/react-maplibre`）への直接依存を許可パッケージに限定
- オプション: `{ allow: string[] }`（パッケージ名の allow-list）
- 検査範囲: `dependencies` / `peerDependencies` / `devDependencies` / `optionalDependencies`
- 違反条件: 許可リスト外のパッケージが上記いずれかでターゲット依存を宣言
- 典型の使い方（利用者側 config 例）:
  ```js
  // dep-fence.config.mjs
  export const policies = [
    { rule: 'maplibre-allowlist', options: { allow: ['@hierarchidb/ui-map', '@hierarchidb/feature-map-adapter'] }, severity: 'ERROR' },
    // ...
  ];
  ```

2) ui-peer-policy
- 出所: `scripts/dep-fence-rules/ui-peer-policy.mjs`
- 目的: UI 基盤ライブラリは peerDependencies に置く（バンドルしない）。
- オプション: `{ libs: string[] }`（例：`['react','react-dom','@mui/material','@emotion/react','@emotion/styled']`）
- 違反条件: `dependencies` に lib が存在し、かつ `peerDependencies` に同名が存在しない
- 典型の使い方（利用者側 config 例）:
  ```js
  export const policies = [
    { rule: 'ui-peer-policy', options: { libs: ['react','react-dom','@mui/material','@emotion/react','@emotion/styled'] }, severity: 'ERROR' },
  ];
  ```

本家リポでの取り込み手順（詳細）
1. ルールファイルの追加
- 新規ファイル（TypeScript 化推奨）
  - `src/rules/maplibre-allowlist.ts`
  - `src/rules/ui-peer-policy.ts`
- 上記 mjs をベースに TS へ移植：
  - 依存チェック対象フィールド：`dependencies`, `peerDependencies`, `devDependencies`, `optionalDependencies`
  - `create(options)` で入力オプションを受け、`check(ctx)` を返す

2. ルールの登録
- ルールレジストリ（例：`src/rules/RuntimeWorkerService.ts`）に `maplibre-allowlist` / `ui-peer-policy` を登録
- ドキュメント（`README` / サイト）に各ルールの目的・オプション・例を追記

3. テスト（必須）
- フィクスチャ構成（例）
  - `fixtures/pkg-allow-maplibre/package.json`（許可 → OK）
  - `fixtures/pkg-disallow-maplibre/package.json`（禁止 → ERROR）
  - `fixtures/pkg-ui-dep/package.json`（`dependencies.react` のみ → ERROR）
  - `fixtures/pkg-ui-peer/package.json`（`peerDependencies.react` → OK）
- テスト項目
  - allow-list に含まれないパッケージでの MapLibre 直依存が検出される
  - libs が `dependencies` のみ→ ERROR、`peerDependencies` あり→ OK
  - severity の切替、空オプション時のデフォルト動作

4. 型とガイドの更新
- ルールのオプション型・サンプル配置を dep-fence の型定義とドキュメントに追加
- 変更履歴に「新しいルールを追加」を明記

（参考）使用側での設定例
- このリポでは、以下のように `dep-fence.config.mjs` で統合運用しています：
  ```js
  export const policyOptions = {
    mapLibreAllowedPackages: ['@hierarchidb/ui-map','@hierarchidb/feature-map-adapter'],
    uiPeerLibs: ['react','react-dom','@mui/material','@emotion/react','@emotion/styled'],
  };
  // 実際の dep-fence では policies 配列に個別ルールとして追加する想定です。
  ```

オプション：未使用依存レポート（情報ルール）
- 参考実装: `scripts/report-dep-prune.mjs`
- dep-fence 本体に INFO/WARN ルールとして内包する場合の案：
  - ルール名例: `unused-deps-report`
  - オプション: `ignore: string[]`, `ignoreByPackage: Record<string,string[]>`
  - ロジック: `src/**/*.{ts,tsx,js,jsx,mjs,cjs}` から `import/require/dynamic import` を抽出 → `dependencies` と突合
  - 出力: `Remove` 候補（完全未参照）、`Move to devDependencies` 候補（scripts でのみ参照）

非対象（本家に入れないもの）
- 実行時の環境状態チェック（lockfile と node_modules の時刻差など）は dep-fence の領域外。
  - 本リポでは pre-dev（`scripts/run-env-vite.sh`）や開発用プラグイン（dev-health）で扱っています。

ライセンス/帰属
- ここで提供した 2 ルールは、dep-fence 本家へ寄贈する前提の PR 素材です。必要に応じて TS 化・命名・コメント文言等を調整ください。

問い合わせ先
- 本ガイド・素材に関する質問があれば、このリポのメンテナに連絡してください。

