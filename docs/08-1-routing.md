## 8.1 ルーティング概要 

### 8.1.1 概要

React Router v7 のファイルベース・ルーティング（app/routes のフラットファイル命名）と段階的 clientLoader（各階層でのデータ集約）により処理する。

基本的に、階層的URLパターン `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?` によって構成される。

(内部仕様）:
- app/routes ディレクトリ配下のフラットファイル命名で階層を表現する
- 各階層に clientLoader を配置し、`useLoaderData` で段階的に統合されたデータを取得する
- WorkerAPIClient 経由でツリー・ノード情報を取得し、`useRouteLoaderData` を使った階層ごとのデータ参照ヘルパーを提供


### 8.1.2 URLパターン設計

#### 8.1.2.1 基本パターン
```
/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?
```

- `treeId`: Tree識別子
- `pageTreeNodeId`: 現在表示中のノード（オプション）
- `targetTreeNodeId`: 操作対象のノード（オプション）
- `treeNodeType`: プラグイン識別子として機能（basemap, shape, location 等）
- `action`: プラグイン内のアクション（edit, preview, batch, settings等）

#### 8.1.2.2 具体例
```
# 通常のツリー表示（プラグインなし）
/t/tree-123/node-456

# BasemapプラグインのEdit画面
/t/tree-123/node-456/node-789/basemap/edit

# ShapeプラグインのBatch処理
/t/tree-123/node-456/node-789/shape/batch?step=2
```

#### 8.1.2.3 ファイル構造

現在は app/routes ディレクトリ配下の「フラットファイル命名」で階層を表現する。各セグメントは () で囲んだ動的パラメータとして表記し、ドットで連結する。

```
packages/app/app/routes/
├── root.tsx                                 # レイアウトと <Outlet />
├── _index.tsx                               # /
├── t._index.tsx                             # /t
├── t.($treeId).tsx                          # /t/:treeId
├── t.($treeId)._layout.tsx                  # /t/:treeId のレイアウト
├── t.($treeId).($pageTreeNodeId).tsx        # /t/:treeId/:pageTreeNodeId
├── t.($treeId).($pageTreeNodeId)._layout.tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId)._layout.tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).tsx
├── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType)._layout.tsx
└── t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx
```

補足:
- 各階層のファイルに clientLoader を定義し、必要なデータのみを段階的にロードする。
- レイアウトファイル（_layout.tsx）を併用して共通UI/エラーバウンダリ/サブアウトレットを提供する。

### 8.1.3 データ仕様

#### 8.1.3.1 RouteParams仕様

```typescript
interface RouteParams {
  treeId: string;              // Tree識別子
  pageTreeNodeId?: string;     // 現在表示中のノード
  targetTreeNodeId?: string;   // 操作対象のノード
  treeNodeType?: string;       // プラグイン識別子（basemap, shape 等）
  action?: string;             // プラグイン内アクション（edit, preview等）
}

interface QueryParams {
  step?: string;               // ウィザードステップ等
  [key: string]: string | undefined;
}
```

#### 8.1.3.2 LoaderData仕様

```typescript
interface LoaderData {
  treeContext: {
    tree: Tree;
    currentNode: TreeNode | null;
    breadcrumbs: BreadcrumbItem[];
    expandedNodes: Set<TreeNodeId>;
  };
  targetNode: TreeNode | null;
  pluginData: unknown;  // プラグイン固有のデータ
}
```

#### 8.1.3.3 ツリー表示用データモデル

UI層におけるツリー表示用のデータモデル

本章では、プラグインに依存しないアプリケーションのベースUI（ホーム画面、情報画面、プロバイダ等）について説明する。ここでいう「ベースUI」とは、アプリの土台となるレイアウト/テーマ/共通ページ群のことで、プラグイン（treeNodeType別のUI）に先立って読み込まれ、全体のユーザー体験を支える。

- 対象コード:
  - `packages/app/app/routes/_index.tsx`（ホーム）
  - `packages/app/app/routes/info.tsx`（情報画面）
  - `packages/app/app/routes/providers.tsx`（テーマ等のプロバイダ）
  - 認証関連: 9章参照（`auth.callback.tsx`, `silent-renew.tsx`）
- 関連章: 5章（UIモジュール構成）, 8章（プラグイン・ルーティング）

##### ルーティングの基本構造

React Router v7 のファイルベース・ルーティングを採用しており、`app/routes` 直下に各画面が定義される。
- ルート `/` → `_index.tsx`
- ルート `/info` → `info.tsx`
- プロバイダ的なルート（テーマ注入など）→ `providers.tsx`（親レイアウト用途）
- プラグイン系（階層的URL）→ 11章（および8章）にて解説

##### ホーム画面（_index.tsx）

`packages/app/app/routes/_index.tsx` は最初に表示されるランディング的画面で、MUI コンポーネントを用いて簡潔に構成されている。

- UI構成（抜粋）
  - タイトル（`Typography h2`）
  - サブコピー（`Typography body1`）
  - `/info` への誘導ボタン（`Button component={Link} to="/info"`）
  - 認証状態に応じた CTA（未認証: 「Sign In」/ 認証済: 「ツリーへ移動」など）
- 役割
  - アプリの概要や状態に応じて、情報画面やチュートリアルへの導線を提供
  - ユーザー状態（ログイン済/未ログイン）に応じて CTA を出し分け（9章参照）
  - （参考）../eria-cartograph の実装と同等の構成: ヒーローセクション + 主要CTA + サブリンク群（ヘルプ/ドキュメント）
- 実装メモ
  - `useBFFAuth()` の `isAuthenticated` を読んで条件分岐（9.2参照）
  - CTA からのログイン誘導は `signIn({ forceMethod: 'popup' })` を優先、ブロック時は自動でリダイレクト（9.2/9.6）

##### 情報画面（info.tsx）

`packages/app/app/routes/info.tsx` は `InfoPage` コンポーネントを描画する薄いルート。
- 役割
  - バージョン、依存関係、利用方法、著者情報、ライセンス等を表示する場として設計
  - ドキュメント（本リポジトリの docs）とのリンク集を設置可能
- 実装上の注意
  - 将来的にプライバシーポリシーや利用規約の掲示位置としても流用可能
  - 認証不要の公開ページとしてアクセス可能（認証ガードなし）

##### プロバイダレイヤ（providers.tsx）

テーマやグローバルスタイルをアプリ全体に供給するためのプロバイダ的レイアウトを、専用ルートで用意している。
- MUI テーマ適用: `ThemeProvider` + `CssBaseline`
- マウント完了後の描画: `mounted` フラグで SSR/CSR や初期化タイミングのずれに対処
- 拡張余地
  - i18n プロバイダ、QueryClientProvider、Snackbar/Toast、ErrorBoundary などの共通ラッパーを段階的に統合
  - 認証コンテキスト（`useBFFAuth` を用いた Provider 化）もここで包むことを検討

#### 8.1.4 ベースUIとプラグインUIの責務分離

- ベースUIの責務
  - グローバルなテーマ、レイアウト（ヘッダー、フッター、サイドバーなど）
  - 公開ページ（ホーム、情報、ヘルプ、サポート、サインイン/アウト）
  - ルートガード（認証が必要な領域の入り口で制御）
- プラグインUIの責務（11章）
  - ノードと treeNodeType に応じた画面の切り替え
  - NodeTypeRegistry に登録された UI/アクションのレンダリング

#### 8.1.5 ナビゲーションとアクセス制御

- ナビゲーション
  - ホーム→情報の基本導線
  - 将来的にはヘッダーメニュー/ドロワーで `Resources`/`Projects` などツリー領域への導線を提供
- アクセス制御
  - ベース画面は原則公開。ツリー画面（`/t/...`）は `RequireAuth` などで保護（9章参照）


- 配置場所
  - 10.9 のレイアウト例にある `HeaderAuthButton` を `HeaderAuthMenu` に置き換え可能
  - Provider レイヤ（10.4）で `useBFFAuth` のラッパーを組み込むことも検討（9章参照）

## 10.7 状態管理とデータ取得

- ベース画面では大規模なデータ取得は行わない（軽量）
- 共有状態（テーマ、ユーザー、言語）はプロバイダで供給
- プラグイン画面では `clientLoader` による段階的取得を活用（8章参照）

以下はベースのレイアウトにヘッダーと認証ボタンを配置する例（9章の `HeaderAuthButton` を利用）。プロダクションでは 10.6.1 の `HeaderAuthMenu` への差し替えも推奨。

```tsx
import { Outlet } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { HeaderAuthButton } from './HeaderAuthButton';

export default function RootLayout() {
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>HierarchiDB</Typography>
          <HeaderAuthButton />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 2 }}>
        <Outlet />
      </Box>
    </>
  );
}
```


## 10.10 まとめ

- ベースUIは「アプリの土台」を提供し、プラグインUIに依存せずに動作する
- ルーティング上は `/` と `/info` が公開の基本導線、`providers.tsx` が横断的機能を包む
- 認証、プラグイン・ルーティングはそれぞれ 9章/11章で詳細を定義
