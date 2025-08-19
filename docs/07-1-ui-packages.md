## 7.1 UIモジュール


UIモジュールは機能ごとに複数のパッケージに分割されている。ここではそのうち代表的なものを説明する。

#### 7.1.1 共通ルールとパッケージ構成

- パッケージ命名: `@hierarchidb/ui-<name>`（例: `@hierarchidb/ui-core`, `@hierarchidb/ui-auth`）。
- 依存関係の方針:
  - 相互依存を避ける（輪を作らない）。
  - `ui-core` は各モジュールから参照され得るが、他の機能モジュールに依存しない。
  - 各 `ui-*` は外部ライブラリへは最小限の依存に留める（例: `ui-routing`→react-router）。
- 導入方法（例）:
  - `pnpm add @hierarchidb/ui-core`（必要なものだけ個別導入）。
  - `import { Button } from '@hierarchidb/ui-core'` のようにピンポイントで取り込む（tree-shaking 前提）。
- ディレクトリ構成（目安）:
  - `src/components` コンポーネント群
  - `src/hooks` React フック
  - `src/utils` ユーティリティ
  - `src/theme`/`src/themes` テーマとトークン（ui-core）
  - `src/icons` アイコン（必要な場合）
- ビルド/最適化:
  - ESM 出力・`package.json` の `sideEffects: false` を基本とし tree-shaking を有効化。
  - CSS-in-JS はテーマトークン優先（直値は避ける）。
- バージョニング/互換性:
  - SemVer に従い、UI パッケージはメジャーを極力揃える。
  - 破壊的変更は CHANGELOG に明記し、移行ガイドを添える。
- 命名規約:
  - コンポーネントは PascalCase、フックは `useXxx`、翻訳キーは `ui.<domain>.<name>`。
  - ファイル拡張子は UI 要素を含む場合 `.tsx`、ロジックのみは `.ts`。
- 品質:
  - Storybook による動作カタログ化を推奨、単体テストは `vitest` を想定。
  - `ErrorBoundary` とロギングは `ui-monitoring` を参照。

##### 7.1.2 ui-coreモジュール

##### 目的
- 基本的なUIコンポーネントとテーマシステムを提供。
- Material UI（MUI）をベースとした共通コンポーネント群。
- プロダクト横断で再利用できるデザインと振る舞いを集約し、アプリ側の実装を最小化。

##### 機能要件（具体）
- MUIコンポーネントの薄いラッパーと拡張（デフォルトのアクセシビリティ属性、サイズ/バリアントの統一）。
- テーマ統合（ui-theme 由来のトークンに準拠し、色/間隔/タイポグラフィを一元化）。
- アイコンシステム（名称一貫性、ツリーシェイカブルな個別 import）。
- 通知/ダイアログ（Toast, Snackbar, ConfirmDialog）とキュー制御・自動閉じ/手動閉じ API。
- フィードバックコンポーネント（LoadingIndicator, EmptyState, ErrorState, Skeleton）。
- フォーム部品（TextField, Select, DatePicker）の共通バリデーション・ヘルパーテキスト連携。
- アクセシビリティ基準（WCAG AA）を満たすフォーカスリング/コントラストの既定値。

##### 含まれるもの
- Material UI関連（@mui/material、@mui/icons-material、@mui/x-date-pickers）。
- スタイリング（@emotion/react、@emotion/styled）。
- 基本コンポーネント（Button、Menu、Sidebar、Loading、ErrorBoundary 等）。
- 通知・フィードバック（ToastProvider、useToast、ConfirmDialog）。
- テーマフック/Provider（ui-theme と連携）。
- アイコン定義（/icons）と軽量ユーティリティ（/utils）。

##### 利用例
- `import { Button, useToast } from '@hierarchidb/ui-core'`
- `const toast = useToast(); toast.success(t('saved'));`

##### 設計メモ
- パフォーマンス: コンポーネントは forwardRef と memo を適切に利用。重い依存は遅延 import。
- i18n: ラベル/aria-label は ui-i18n の `t()` による注入を前提。
- エラーバウンダリ: 重要領域には `ErrorBoundary` を配置し ui-monitoring へ委譲。

#### 7.1.3 ui-authモジュール

##### 目的
- 認証・認可機能を提供。
- OAuth2/OIDC 認証の UI コンポーネントとフックを提供し、アプリ側の配線を簡素化。

##### 機能要件（具体）
- 複数認証プロバイダー対応（OIDC: Azure AD/Keycloak 等、OAuth: Google/GitHub）。
- 認証状態管理（`AuthProvider` による context 提供、`useAuth()` で `user`, `signin`, `signout`）。
- セッション管理（Silent Renew/Refresh Token、トークンの安全保管と更新）。
- ルートガード連携（ui-routing の `requireAuth` と協調、未認証時は `/signin?redirect=...`）。
- プロファイル UI（ユーザー名/アバター、アカウントメニュー、権限表示）。
- エラーハンドリング（`AuthErrorBoundary`、再試行 UI、ログ出力は ui-monitoring 経由）。
- CSRF/XSS 対策（トークンはメモリ優先、必要に応じて SameSite Cookie、ストレージへの保存は暗号化/最小化）。

##### 含まれるもの
- OIDC クライアント（oidc-client-ts、react-oidc-context）。
- OAuth ラッパー（@react-oauth/google 等）。
- 認証コンポーネント（AuthPanel、AuthProvider、AuthErrorBoundary）。
- 認証フック（useAuth, useAuthBFF, useAuthGoogle, useAuthOIDC 等）。
- ユーザーコンポーネント（UserLoginButton、UserAvatar、Gravatar）。

##### 利用例
- ルート保護: `element: <RequireAuth><Page/></RequireAuth>` またはルートメタ `requireAuth: true`。

#### 7.1.4 ui-routingモジュール

##### 目的
- ルーティングとナビゲーション機能を提供。
- React Router ベースの型安全なルーティングシステムを構築し、URL 生成・遷移・保護を一貫提供。

##### 機能要件（具体）
- 型安全なルート定義（RouteObject 拡張: `id`, `path`, `params`, `loader`, `action`, `requireAuth`, `breadcrumbs`）。
- ルートガード（`requireAuth`, `featureFlags`, `role` によるアクセス制御）。
- データ先読み（prefetch）と遷移中インジケータ（`useNavigation` 連携）。
- URL ヘルパー（`buildPath(name, params, query)`、`generatePathStrict`、`parseQuery`）。
- パラメータ/クエリの zod スキーマ検証（無効値は 400 ハンドリング）。
- ルート毎 ErrorBoundary/Loader 境界の提供、遅延ロード（`lazy()`）。
- パンくず・メニュー生成用メタデータからの自動生成（`breadcrumbs`）。
- スクロール復元、フォーカス管理、アクセシビリティ配慮。

##### 含まれるもの
- React Router（react-router, react-router-dom）。
- ルーティング設定（/config/routing.ts）とビルダー（`createRoutes(config)`）。
- ナビゲーションコンポーネント（NavLinkMenu、LinkButton、Breadcrumbs）。
- 便利フック（`useRouteParams<T>()`, `useNavigateSafe()`, `usePrefetch()`）。

#### 7.1.5 ui-i18nモジュール

##### 目的
- 国際化（i18n）機能を提供。
- 多言語対応の UI を実現するための Provider/フック/ユーティリティを提供。

##### 機能要件（具体）
- 言語切り替え（`LanguageProvider` と `useI18n()` による `locale`, `setLocale`）。
- 翻訳リソース管理（名前空間分割 `common`, `auth`, `app`、遅延ロード）。
- ブラウザ言語の自動検出（`navigator.languages`、URL/LocalStorage/ブラウザ順に解決）。
- ICU メッセージ/複数形/序数の対応、差し込み（interpolation）と XSS サニタイズ。
- 日付/数値/相対時間フォーマットのヘルパー（Intl API を薄くラップ）。
- アクセシビリティ文脈の翻訳（aria-label, alt テキストなど）。

##### 含まれるもの
- i18next 関連（i18next、react-i18next）。
- 言語検出（i18next-browser-languagedetector）。
- HTTP バックエンド（i18next-http-backend）。
- LanguageProvider とユーティリティ（`useI18n`, `formatDate`, `formatNumber`）。

##### 利用例
- `const { t } = useI18n(); <Button>{t('common.save')}</Button>`
- 検出順序: URL の `?lang=ja` > LocalStorage > ブラウザ設定。

#### 7.1.6 ui-clientモジュール（別章に分離）

このモジュールは厳密には UI ではなく内部サービス（Worker/API）への型安全なクライアント層であるため、別章「07-3 UI クライアント層仕様」に分離した。

- 参照: docs/07-3-ui-client.md
- 内容: hook, client, worker, pub-sub, command, undo/redo がユースケースごとにどのように連携するか（シーケンス図含む）

---

#### 7.1.7 ui-layoutモジュール

##### 目的
- 共通レイアウトの提供（ヘッダー/フッター/サイドバー/レスポンシブグリッド）。
- AppShell パターンでナビゲーション/コンテンツ/補助パネルを構成し再利用性を高める。

##### 機能要件（具体）
- アプリ共通シェル（`<AppShell header leftNav rightPane footer>`）の構築とスロット API。
- レスポンシブ対応（breakpoints によるサイドバー折り畳み、自動ドロワー化）。
- スクロール領域の分離と固定ヘッダー、コンテナ幅のプリセット。
- リサイズ可能ペイン（ResizablePane）と保持（LocalStorage で幅を記憶）。
- スキップリンク/メインランドマークでアクセシビリティを向上。

##### 含まれるもの
- レイアウトコンポーネント（Container/Grid/ResizablePane/StickyHeader 等）。
- AppShell, Sidebar, Header, Footer。

---

#### 7.1.8 ui-navigationモジュール

##### 目的
- ナビゲーションと情報アーキテクチャを提供。
- ルートメタからメニュー/ブレッドクラムを自動生成し一貫性を担保。

##### 機能要件（具体）
- メニュー（ツリー/ドロワー/コンテキスト）生成、選択状態と権限による表示制御。
- ブレッドクラムの自動生成（ui-routing の `breadcrumbs` メタから）。
- アクセシビリティ/キーボード操作（ロービジョン対応のフォーカス、左右/上下操作）。
- アクティブリンクの自動判定とセマンティック（`aria-current`）。
- ディープリンクと外部リンク（外部は `rel="noopener"`/`target` の指針）。

##### 含まれるもの
- NavLinkMenu、LinkButton、Breadcrumbs、SectionNav。
- ルーティング補助（ui-routing と連携）。

---

#### 7.1.9 ui-fileモジュール

##### 目的
- ファイル入出力、外部 URL/ファイルのバリデーション、インポート/エクスポート UI を提供。
- 大容量データでも安全・段階的に処理できるアーキテクチャを提供。

##### 機能要件（具体）
- インポート
  - 拡張子/Content-Type チェック、サイズ上限（例: 50MB 既定、上書き可）。
  - ストリーミング/チャンク読み込み（`ReadableStream`/`FileReader`）と進捗表示。
  - スキーマ検証（zod/JSON Schema）。バリデーションエラーの位置と内容を UI に集約表示。
  - サンドボックス化（`<iframe sandbox>` や Worker でのパース）による XSS/フリーズ防止。
- エクスポート
  - JSON/CSV のストリーム書き出し、BOM オプション、改行コード選択。
  - ダウンロードの再開可否、およびファイル名規約（`{app}-{entity}-{yyyymmddHHMM}`）。
- 外部 URL 検証
  - プロトコル許可リスト（https, data:json 限定など）とドメイン許可リスト。
  - CORS/`Content-Security-Policy` との整合、HTTP ヘッダ検証（`Content-Type`, `Content-Length`）。

##### 含まれるもの
- バリデーションユーティリティ（/src/utils/validation.ts 等: `validateExternalURL`, `validateFileMeta`）。
- ファイル選択/ドラッグ&ドロップコンポーネント（`FileDropzone`, `FilePicker`）。
- 進捗/結果ダイアログ（`ImportDialog`, `ExportDialog`）。
- Worker ベースのパーサー（任意）。

---

#### 7.1.10 ui-monitoringモジュール

##### 目的
- クライアント側のロギング、エラーレポート、簡易メトリクス収集。
- 重要イベント/UX 指標（LCP/FID/CLS 等）を収集し可視化・転送する。

##### 機能要件（具体）
- ErrorBoundary による例外捕捉とユーザー向け代替 UI、スタックトレース収集。
- Logger（info/warn/error/debug）とシンク（console/remote）。PII マスキング、サンプリング。
- メトリクス収集（ページ/画面遷移、操作回数、API レイテンシ）。
- デベロッパーオーバーレイ（DEV のみ）とトースト通知のブリッジ（ui-core の Toast）。
- 監視先の抽象化（OpenTelemetry/独自エンドポイントへの送信）。

##### 含まれるもの
- Logger、ErrorBoundary、診断用ウィジェット、計測ヘルパー（`useMeasure`）。

##### 利用例
- `wrap(<App/>)` を `MonitoringProvider` で包み、`logger.error(err, ctx)` を各層で利用。

---

#### 7.1.11 ui-tourモジュール

##### 目的
- 初回利用者向けのガイド/ツアー機能。
- 主要機能のオンボーディングを段階的に提示し、学習コストを下げる。

##### 機能要件（具体）
- ステップ定義（ターゲット要素セレクタ、説明、配置、次へ/前へ/スキップ）。
- 強調表示（スポットライト/背景マスク）とスクロール追従、レスポンシブ対応。
- 進捗保存（LocalStorage）と中断/再開、バージョン管理（UI 更新で再表示制御）。
- アクセシビリティ（キーボード操作、フォーカスマネジメント、スクリーンリーダー対応）。

##### 含まれるもの
- ツアーコンポーネント（Tour, TourStep）、ステップ管理フック（useTour）。

##### 利用例
- 初回起動時のみ `startTour('getting-started')` を実行、ユーザーがスキップ可能にする。




#### 7.1.12 ui-themeモジュール

##### 目的
- デザインシステムの中核（デザイントークン、テーマ切替、MUI ブリッジ、CSS 変数出力）を提供。
- アプリ横断で一貫したスタイルとアクセシビリティを担保。

##### 機能要件（具体）
- デザイントークン管理（semantic tokens: color.bg, color.fg, surface, success/warn/error, spacing, radius, elevation, zIndex）。
- テーマ生成器（`createTheme(preset, overrides)`）とダーク/ライト/ハイコントラスト切替、OS 設定連動（prefers-color-scheme）。
- CSS 変数エクスポート（`:root { --color-bg: ... }`）と MUI Theme 同期（`muiThemeBridge(tokens)`）。
- タイポグラフィスケール（`h1..caption`、フォントファミリ設定、多言語フォールバック）。
- レスポンシブ設定（breakpoints, container widths）とスペーシングユニット（`space(n)`）。
- アイコンサイズ、フォーカスリング、コントラスト比を WCAG AA 以上で定義。

##### 含まれるもの
- `src/theme/tokens.ts`（トークン定義）
- `src/theme/createTheme.ts`（テーマ生成）
- `src/theme/mui.ts`（MUI ブリッジ）
- `ThemeProvider`/`useThemeMode`/`ColorSchemeToggle`

---

#### 7.1.13 ui-landingpageモジュール

##### 目的
- 初回訪問者向けのランディングページ UI を提供（プロダクト紹介・クイックスタート・CTA）。

##### 機能要件（具体）
- ヒーローセクション、特徴一覧、スクリーンショット/デモ埋め込み。
- クイックスタート（サンプルデータ読み込み、チュートリアルへの導線）。
- 匿名セッション/同意バナー（Cookie/テレメトリのオプトイン）。
- i18n とテーマ（ui-i18n, ui-theme）連携、レスポンシブ対応。
- CTA ボタン群（サインイン/ドキュメント/アプリ起動）。

##### 含まれるもの
- コンポーネント（Hero, FeatureList, CTAButtons, DemoSection）。
- ルーティング連携（ui-routing の LinkButton）。
- 解析向けのイベントフック（ui-monitoring と連携）。
