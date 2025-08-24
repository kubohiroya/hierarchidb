## 8.1 ルーティング概要 

### 8.1.1 概要

React Router v7 のファイルベース・ルーティング（app/routes のフラットファイル命名）と段階的 clientLoader（各階層でのデータ集約）により処理する。

基本的に、階層的URLパターン `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?` によって構成される。

(内部仕様）:
- app/routes ディレクトリ配下のフラットファイル命名で階層を表現する
- 各階層に clientLoader を配置し、`useLoaderData` で段階的に統合されたデータを取得する
- WorkerAPIClient 経由でツリー・ノード情報を取得し、`useRouteLoaderData` を使った階層ごとのデータ参照ヘルパーを提供

たとえばWorkerAPIClient.getSingleton()はasyncなので、これを自前のReactのカスタムフックで得るのではなく、React Routerの仕組みを使って、useRouteLoaderDataで非同期初期化済みのものを得るようにしている。
同様のケースがあれば、カスタムフックをつくって内部でuseEffectで非同期に値を得るのではなく、ここでのuseRouteLoaderDataを使うパターンを真似ることを推奨する。

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
  treeNodeType?: string;       // プラグイン識別子（basemap, shape_obsolate 等）
  action?: string;             // プラグイン内アクション（edit, preview等）
}

interface QueryParams {
  step?: string;               // ウィザードステップ等
  [key: string]: string | undefined;
}
```

#### 8.1.3.2 LoaderData仕様（実装準拠）

実装では、各階層の clientLoader が段階的にフィールドを足し合わせて返す設計であり、従来記載していた `treeContext` や `breadcrumbs` は現状のコードには存在しない。以下は実装に準拠したベースの形である（出典: `packages/app/src/loader.ts`）。

```typescript
// 最下層（/t/.../:treeNodeType?/:action?）まで含んだ場合の包括的な型
interface LoaderDataBase {
  // 共通（グローバル）
  appConfig?: LoadAppConfigReturn;       // すべての階層で共通（root.tsx にて注入・参照可能）
  
  // 段階的に各 loader が追加するフィールド
  client: WorkerAPIClient;               // /t の時点で提供
  tree?: Tree;                           // /t/:treeId で提供
  pageTreeNode?: TreeNode;               // /t/:treeId/:pageTreeNodeId? で提供（未指定時はルートノード解決）
  targetTreeNode?: TreeNode;             // /t/:treeId/:pageTreeNodeId?/:targetTreeNodeId? で提供
  treeNodeType?: TreeNodeType;           // /t/.../:treeNodeType? で提供（パラメータの型アサーション）
  action?: TreeNodeAction;               // /t/.../:treeNodeType?/:action? で提供（パラメータの型アサーション）
}
```

補足: `appConfig` は各 loader が毎回返却しているわけではなく、最上位の `root.tsx` で読み込まれアプリ全体から参照可能な「グローバル値」です。取得には `useAppConfig()`（現状は `/info` の loader に依存）を用いるか、将来的な `AppConfigProvider`（8.1.6 参照）経由を想定しています。

- 各階層の具体的な返却型は次の通り（実体は型合成）：
  - `LoadTreeReturn` → `LoadPageTreeNodeReturn` → `LoadTargetTreeNodeReturn` → `LoadTreeNodeTypeReturn` → `LoadTreeNodeActionReturn`
- 既定のID解決:
  - `pageTreeNodeId` 未指定時: `treeId + TreeNodeTypes.Root`
  - `targetTreeNodeId` 未指定時: `targetTreeNodeId || pageTreeNodeId || treeId + TreeNodeTypes.Root`
- `treeNodeType` と `action` は、URL 文字列をそれぞれ `TreeNodeType`/`TreeNodeAction` へ型アサーションして返す（存在検証は別層）。

#### 8.1.3.3 ベースUI（root.tsx 統合）

UI層におけるツリー表示用のデータモデルに先立ち、ベースUIはアプリ全体のレイアウト/テーマ/共通ページ群を提供する。現行実装では、テーマ等のプロバイダは `root.tsx` に統合されており、`providers.tsx` という専用ファイルは存在しない。

- 対象コード（実態）：
  - `packages/app/src/root.tsx`（テーマ/Helmet/レイアウト統合）
  - `packages/app/src/routes/_index.tsx`（ホーム）
  - `packages/app/src/routes/info.tsx`（情報画面）
  - 認証関連: `packages/app/src/routes/auth.callback.tsx`, `packages/app/src/routes/silent-renew.tsx`

##### ルーティングの基本構造

React Router v7 のファイルベース・ルーティングを採用しており、`app/src/routes` 直下に各画面が定義される。
- ルート `/` → `_index.tsx`
- ルート `/info` → `info.tsx`
- プロバイダは `root.tsx` 内の `ThemeProvider`/`HelmetProvider` 等で一括適用

##### ホーム画面（_index.tsx）

`packages/app/src/routes/_index.tsx` は最初に表示されるランディング的画面で、MUI コンポーネントを用いて簡潔に構成されている。

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
  - CTA からのログイン誘導は `signIn({ forceMethod: 'popup' })` を優先、ブロック時は自動でリダイレクト

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
  - ヘッダーメニュー/ドロワーで `Resources`/`Projects` などツリー領域への導線を提供
- アクセス制御
  - ベース画面は原則公開。ツリー画面（`/t/...`）から開くノードの作成または編集のためのダイアログで、一部のノード種類(stylemap, shape, location, route)で、 外部ファイルのダウンロードやAPIアクセスを行う内容を実現する、特定のステップだけが保護対象などで保護する。


- 配置場所
  - レイアウト例にある `HeaderAuthButton` を `HeaderAuthMenu` に置き換え可能
  - Provider レイヤで `useBFFAuth` のラッパーを組み込むことも検討

### 8.1.6 トップレベル appConfig の注入と仕様

- 目的: 最上位（root.tsx）でアプリ共通の表示・メタ情報を集中管理し、全画面で一貫したタイトル/説明/テーマ等を提供する。
- 読み込みタイミング: `packages/app/src/root.tsx` にて `await loadAppConfig()` を実行し、`Helmet` で `<title>`/`<meta name="description">`/`<link rel="icon">` を設定。
- 提供API: `packages/app/src/loader.ts`
  - `loadAppConfig(): Promise<LoadAppConfigReturn>`
  - `useAppConfig()`（現状: `/info` ルートの loader に依存。改善提案あり下記参照）
- グローバル提供: `appConfig` は最上位で読み込まれ、全ルートから参照可能（8.1.9.1 の表でも「提供フィールド」に共通として含める）。
- フィールド一覧（LoadAppConfigReturn）:
  - `appPrefix: string` … ベースパス（`VITE_APP_PREFIX`）
  - `appName: string` … アプリ名（`VITE_APP_NAME`。既定: HierarchiDB）
  - `appTitle: string` … 表示タイトル（`VITE_APP_TITLE`。既定: HierarchiDB）
  - `appDescription: string` … メタ説明（`VITE_APP_DESCRIPTION`。既定あり）
  - `appDetails: string` … 詳細説明（`VITE_APP_DETAILS`。既定あり）
  - `appHomepage: string` … ホーム/リポジトリURL（現状は `APP_HOMEPAGE` を参照）
  - `appLogo: string` … ロゴパス（`VITE_APP_LOGO`。既定: `logo.png`）
  - `appFavicon: string` … Favicon パス（`VITE_APP_FAVICON`。既定: `logo.favicon.png`）
  - `appTheme: string` … テーマ名（`VITE_APP_THEME`。既定: `light`）
  - `appLocale: string` … 既定ロケール（`VITE_APP_LOCALE`。既定: `en-US`）
  - `appDefaultLocale: string` … デフォルトロケール（固定: `en-US`）
  - `appDefaultLanguage: string` … デフォルト言語（固定: `en`）
  - `appAttribution: string` … クレジット（`VITE_APP_ATTRIBUTION`）
- 環境変数の優先順位: `import.meta.env.*` → 既定値。Vite クライアント公開には `VITE_` プレフィックスが必要。
- 利用例:
  - ルート: Helmet による `<title>`/`meta`/`icon` 設定
  - `/info`: `InfoPage` でアプリ情報/ライセンス表示

注意点（抜け漏れ/改善提案）:
- [指摘] `appHomepage` が `import.meta.env.APP_HOMEPAGE` を参照しているが、Vite では `VITE_` プレフィックスが無い環境変数はクライアントへ露出しない。提案: キー名を `VITE_APP_HOMEPAGE` に変更し、`loadAppConfig` でも同名を参照する。
- [指摘] `useAppConfig()` が `useRouteLoaderData('/info')` に依存し、`/info` が未ロードだと値取得できない可能性がある。提案: ルートレイアウトの context もしくは React コンテキストで appConfig を供給し、全ルートから参照できるようにする（例: `<AppConfigProvider value={appConfig}>`).
- [指摘] `appDefaultLocale`/`appDefaultLanguage` が固定値。提案: 必要に応じて `VITE_APP_DEFAULT_LOCALE`/`VITE_APP_DEFAULT_LANGUAGE` に対応。
- [指摘] Favicon 既定値 `logo.favicon.png` は一般的な拡張子/パスでない可能性。提案: `favicon.svg` などプロジェクトの実ファイルに合わせる。

### 8.1.7 状態管理とデータ取得

- ベース画面では大規模なデータ取得は行わない（軽量）
- 共有状態（テーマ、ユーザー、言語）はプロバイダで供給
- プラグイン画面では `clientLoader` による段階的取得を活用（8章参照）

以下はベースのレイアウトにヘッダーと認証ボタンを配置する例。プロダクションでは `HeaderAuthMenu` への差し替えも推奨。

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


### 8.1.8 まとめ

- ベースUIは「アプリの土台」を提供し、プラグインUIに依存せずに動作する
- ルーティング上は `/` と `/info` が公開の基本導線、`providers.tsx` が横断的機能を包む
- 認証、プラグイン・ルーティングはそれぞれ 9章/11章で詳細を定義


### 8.1.9 `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?` 各階層の clientLoader が返す型と利用可能値

本節では、階層的に配置された各ルートの clientLoader がどのような TypeScript 型を返し、どの値が利用できるかを整理する。実装の出典は `packages/app/src/loader.ts`。

段階的に次の型が合成される（上位→下位へとフィールドが増えていく）。
- 型: `LoadTreeReturn` → `LoadPageTreeNodeReturn` → `LoadTargetTreeNodeReturn` → `LoadTreeNodeTypeReturn` → `LoadTreeNodeActionReturn`
- 関数: `loadTree` → `loadPageTreeNode` → `loadTargetTreeNode` → `loadTreeNodeType` → `loadTreeNodeAction`

補助フック（`useRouteLoaderData` ベース）も用意されている。
- `useWorkerAPIClient()`
- `useTree()`
- `usePageTreeNode()`
- `useTargetTreeNode()`
- `useTreeNodeType()`
- `useTreeNodeTAction()`

---

1) t.($treeId).tsx（/t/:treeId）
- clientLoader 想定: `loadTree(args as LoadTreeArgs)`
- 引数型: `LoadTreeArgs` { treeId: string }
- 返却型: `LoadTreeReturn`
  - フィールド
    - `client: WorkerAPIClient` … UI と Worker(API) のブリッジ
    - `tree: Tree | undefined` … 指定 `treeId` のツリー。見つからない場合は `undefined`
- 重要ポイント
  - `treeId` が未指定の場合はエラー: `throw new Error('treeId is required')`

型定義抜粋:
```ts
export type LoadTreeReturn = { tree: Tree | undefined } & { client: WorkerAPIClient };
```

---

2) t.($treeId).($pageTreeNodeId).tsx（/t/:treeId/:pageTreeNodeId?）
- clientLoader 想定: `loadPageTreeNode(args as LoadPageTreeNodeArgs)`
- 引数型: `LoadPageTreeNodeArgs` { treeId: string; pageTreeNodeId: string }
- 返却型: `LoadPageTreeNodeReturn`（`LoadTreeReturn` を内包）
  - フィールド
    - `client: WorkerAPIClient`
    - `tree: Tree | undefined`
    - `pageTreeNode: TreeNode | undefined`
- 既定解決
  - `pageTreeNodeId` が空なら、`treeId + TreeNodeTypes.Root` をノードIDとして解決（ルートノード）

実装抜粋:
```ts
pageTreeNode: await loadTreeReturn.client.getAPI().getNode({
  treeNodeId: pageTreeNodeId || treeId + TreeNodeTypes.Root,
})
```

---

3) t.($treeId).($pageTreeNodeId).($targetTreeNodeId).tsx（/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?）
- clientLoader 想定: `loadTargetTreeNode(args as LoadTargetTreeNodeArgs)`
- 引数型: `LoadTargetTreeNodeArgs` { treeId: string; pageTreeNodeId: string; targetTreeNodeId: string }
- 返却型: `LoadTargetTreeNodeReturn`（`LoadPageTreeNodeReturn` を内包）
  - フィールド
    - `client, tree, pageTreeNode`（上記同様）
    - `targetTreeNode: TreeNode | undefined`
- 既定解決の優先順位
  1) `targetTreeNodeId` があればそれを使う
  2) 無ければ `pageTreeNodeId` を使う
  3) それも無ければ `treeId + TreeNodeTypes.Root`

実装抜粋:
```ts
targetTreeNode: await loadPageTreeNodeReturn.client.getAPI().getNode({
  treeNodeId: targetTreeNodeId || pageTreeNodeId || treeId + TreeNodeTypes.Root,
})
```

---

4) t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).tsx（/t/.../:treeNodeType?）
- clientLoader 想定: `loadTreeNodeType(args as LoadTreeNodeTypeArgs)`
- 引数型: `LoadTreeNodeTypeArgs` { treeId: string; pageTreeNodeId: string; targetTreeNodeId: string; treeNodeType: string }
- 返却型: `LoadTreeNodeTypeReturn`（`LoadTargetTreeNodeReturn` を内包）
  - フィールド
    - `client, tree, pageTreeNode, targetTreeNode`（上記同様）
    - `treeNodeType: TreeNodeType | undefined`
- 型付けの注意
  - `treeNodeType` はルートパラメータ文字列を型アサーションで `TreeNodeType` に割当（レジストリ検証はこの層では未実施）

実装抜粋:
```ts
return { ...loadTargetTreeNodeReturn, treeNodeType: treeNodeType as TreeNodeType | undefined };
```

---

5) t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx（/t/.../:treeNodeType/:action?）
- 実装ファイル: `packages/app/src/routes/t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx`
- clientLoader: `loadTreeNodeAction(args.params as LoadTreeNodeActionArgs)`
- 引数型: `LoadTreeNodeActionArgs` { treeId: string; pageTreeNodeId: string; targetTreeNodeId: string; treeNodeType: string; action: string }
- 返却型: `LoadTreeNodeActionReturn`（`LoadTreeNodeTypeReturn` を内包）
  - フィールド
    - `client: WorkerAPIClient`
    - `tree: Tree | undefined`
    - `pageTreeNode: TreeNode | undefined`
    - `targetTreeNode: TreeNode | undefined`
    - `treeNodeType: TreeNodeType | undefined`
    - `action: TreeNodeAction | undefined`
- 型付けの注意
  - `action` も `treeNodeType` 同様、文字列を型アサーションで `TreeNodeAction` に割当。実在チェックはプラグイン側で行う想定。

コンポーネント側の利用例:
```tsx
const data = useLoaderData() as LoadTreeNodeActionReturn;
// data.tree?.treeId, data.pageTreeNode?.treeNodeId, data.targetTreeNode?.treeNodeId,
// data.treeNodeType, data.action が利用可能
```

---

参照フック（useRouteLoaderData ベース）
- ルートIDはファイルパスに対応する文字列。各階層の loader の結果を取り出すヘルパーがある。
  - `useWorkerAPIClient(): WorkerAPIClient` … ルートID `'t'`
  - `useTree(): Tree | undefined` … ルートID `'t/($treeId)'`
  - `usePageTreeNode(): TreeNode | undefined` … ルートID `'t/($treeId)/($pageTreeNodeId)'`
  - `useTargetTreeNode(): TreeNode | undefined` … ルートID `'t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)'`
  - `useTreeNodeType(): TreeNodeType | undefined` … ルートID `'t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)/($treeNodeType)'`
  - `useTreeNodeTAction(): TreeNodeAction | undefined` … ルートID `'t/($treeId)/($pageTreeNodeId)/($targetTreeNodeId)/($treeNodeType)/($action)'`

注意点とベストプラクティス
- `undefined` 許容: `tree`/`pageTreeNode`/`targetTreeNode`/`treeNodeType`/`action` は存在しない場合に `undefined` となり得るため、UI 側で分岐を行う。
- 既定ID解決の理解:
  - `pageTreeNodeId` 未指定 → ルートノード（`treeId + TreeNodeTypes.Root`）
  - `targetTreeNodeId` 未指定 → `pageTreeNodeId` もしくはルートノード
- 値検証の層分け:
  - `treeNodeType` と `action` は型アサーションのみ。プラグイン・レジストリでの検証や 404/ガード処理は別層で実装する。
- エラーハンドリング:
  - `treeId` 未指定は明示エラーを投げる設計。リンク生成時に漏れを防ぐ。
- 最適化のヒント:
  - 同一 `tree` コンテキストで遷移する場合、親レイアウト側で `client`/`tree` を先行ロードし、子は差分のみ取得する（React Router の nested loaders）。

#### 8.1.9.1 省略パターンと提供される loaderData 一覧（/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?）

次の表は、各ルートパラメータの省略/指定に応じて、loaderData にどのフィールドが含まれ、どの値が既定解決されるかをまとめたもの（実装: `packages/app/src/loader.ts`）。

注: `appConfig` は root.tsx によりグローバル提供されます（loaderData に含まれない場合でも `useAppConfig()` で参照可能）。したがって、以下の提供フィールドには常に `appConfig` を含めています。

| パス例 | 解釈されるID | 提供フィールド | 備考 |
|---|---|---|---|
| `/t/tree-1` | pageTreeNodeId: 未指定 → `tree-1 + Root`、targetTreeNodeId: 未指定 | `appConfig`, `client`, `tree` | `/t/:treeId` レベル。`pageTreeNode` はこの段階ではまだ提供されない |
| `/t/tree-1/node-A` | pageTreeNodeId: `node-A`、targetTreeNodeId: 未指定 | `appConfig`, `client`, `tree`, `pageTreeNode` | `pageTreeNodeId` 未指定なら `tree-1+Root` を自動解決 |
| `/t/tree-1/` | pageTreeNodeId: 未指定 → `tree-1 + Root` | `appConfig`, `client`, `tree`, `pageTreeNode` | 末尾スラッシュ等で `pageTreeNodeId` が空の場合、ルートノードが返る |
| `/t/tree-1/node-A/node-B` | targetTreeNodeId: `node-B` | `appConfig`, `client`, `tree`, `pageTreeNode`, `targetTreeNode` | `targetTreeNodeId` 未指定時は `pageTreeNodeId` にフォールバック |
| `/t/tree-1/node-A/` | targetTreeNodeId: 未指定 → `node-A` | `appConfig`, `client`, `tree`, `pageTreeNode`, `targetTreeNode` | `targetTreeNodeId || pageTreeNodeId || treeId+Root` の順で解決 |
| `/t/tree-1//` | pageTreeNodeId 未指定、targetTreeNodeId 未指定 → `tree-1 + Root` | `appConfig`, `client`, `tree`, `pageTreeNode`, `targetTreeNode` | 両方未指定でも両者ともルートノードで解決され得る |
| `/t/tree-1/node-A/node-B/basemap` | treeNodeType: `basemap` | `appConfig`, これまで + `treeNodeType` | `treeNodeType` は文字列を `TreeNodeType` に型アサート（存在検証は別層） |
| `/t/tree-1/node-A/node-B/basemap/edit` | action: `edit` | `appConfig`, これまで + `action` | `action` は文字列を `TreeNodeAction` に型アサート |
| `/t/tree-1/node-A/node-B//edit` | treeNodeType 未指定 → `undefined`、action: `edit` | `appConfig`, `action` は返るが `treeNodeType` は `undefined` | 実装上は可能だが、プラグイン側での検証/ガードが必要 |

要点:
- `pageTreeNode` は `/t/:treeId/:pageTreeNodeId?` で提供され、未指定時はルートノード（`treeId + TreeNodeTypes.Root`）。
- `targetTreeNode` は `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?` で提供され、`targetTreeNodeId || pageTreeNodeId || treeId + TreeNodeTypes.Root` の優先順位で解決。
- `treeNodeType` と `action` は URL 文字列を型アサーションでそのまま返すため、存在/権限の検証はプラグイン層やルートガードで行う。

## 8.2 React Router v7 + MUI の SSR/Hydration 対応実装ガイド

### 8.2.1 概要

React Router v7とMaterial-UIを組み合わせたSPAアプリケーションにおいて、SSR/Hydration警告を解消し、安定した動作を実現するための実装パターンをまとめます。

### 8.2.2 問題と解決策

#### 8.2.2.1 SSR/Hydration 不一致による警告

**問題:**
```
Warning: Extra attributes from the server: style Error Component Stack
```

**原因:**
- MUIのEmotionスタイルエンジンがサーバー側とクライアント側で異なるスタイルを生成
- `sessionStorage`へのアクセスがSSR時に利用できない
- React Router v7のhydration処理との競合

**解決策:**

1. **Layout コンポーネントでの hydration 警告抑制**
```tsx
// packages/_app/src/root.tsx
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

2. **MUI スタイルエンジンの統一**
```tsx
// packages/_app/src/root.tsx
import { StyledEngineProvider } from '@mui/material/styles';

export default function App() {
  const theme = useMemo(() => createAppTheme('light'), []);

  return (
    <AppConfigProvider>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </StyledEngineProvider>
    </AppConfigProvider>
  );
}
```

3. **Client-side状態の安全な管理**
```tsx
// packages/_app/src/routes/_index.tsx
export default function Index() {
  // SSR/hydration不一致を防ぐためのクライアント判定
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // sessionStorageの安全なアクセス
  const getSavedPageNodeId = useCallback((treeId: string): string | null => {
    if (!isClient) return null; // SSR時はnullを返す
    try {
      return sessionStorage.getItem(getSessionStorageKey(treeId));
    } catch {
      return null;
    }
  }, [isClient]);
}
```

#### 8.2.2.2 React Router v7 の設定

**SPAモード設定:**
```typescript
// packages/_app/react-router.config.ts
const config: ReactRouterConfig = {
  appDirectory: 'src',
  prerender: false,
  ssr: false, // SSRを無効化
  basename,
  async buildEnd(args): Promise<void> {
    // GitHub Pages用の設定など
  },
};
```

**Entry Client の実装:**
```tsx
// packages/_app/src/entry.client.tsx
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```

#### 8.2.2.3 Vite設定での最適化

**モジュール重複の解決:**
```typescript
// packages/_app/vite.config.ts
export default defineConfig({
  resolve: {
    // @emotion/reactとreactの重複を解決
    dedupe: ['@emotion/react', '@emotion/styled', 'react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
  },
});
```

### 8.2.3 ベストプラクティス

#### 8.2.3.1 SSR対応コンポーネントの設計原則

**❌ 避けるべきパターン:**
```tsx
// 直接的なDOM/BOM APIのアクセス
const data = localStorage.getItem('key'); // SSR時にエラー

// 不安定な値の使用
const id = Math.random(); // SSR/CSRで異なる値
```

**✅ 推奨パターン:**
```tsx
// クライアント判定フラグの使用
const [isClient, setIsClient] = useState(false);
useEffect(() => setIsClient(true), []);

// 条件付きアクセス
const data = isClient ? localStorage.getItem('key') : null;

// 安定した初期値
const [id] = useState(() => crypto.randomUUID()); // useMemoでも可
```

#### 8.2.3.2 テーマとスタイリングの統一

**MUIテーマの安定化:**
```tsx
// テーマの安定化でhydration不一致を防ぐ
const theme = useMemo(() => createAppTheme('light'), []);

// StyledEngineProviderでスタイル優先度を制御
<StyledEngineProvider injectFirst>
  <ThemeProvider theme={theme}>
```

#### 8.2.3.3 段階的なクライアント機能の有効化

**段階的な機能有効化パターン:**
```tsx
function MyComponent() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 基本表示（SSR対応）
  if (!mounted) {
    return <BasicView />;
  }
  
  // 完全機能版（CSRのみ）
  return <EnhancedView />;
}
```

### 8.2.4 トラブルシューティング

#### 8.2.4.1 よくあるエラーと対処法

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `Extra attributes from the server: style` | MUIスタイルの不一致 | `StyledEngineProvider` + `suppressHydrationWarning` |
| `localStorage is not defined` | SSR時のBOM APIアクセス | `isClient`フラグで条件付きアクセス |
| コンテンツが表示されない | Entry clientの設定ミス | 標準的な`hydrateRoot`パターンを使用 |
| テーマが反映されない | テーマプロバイダーの順序 | `StyledEngineProvider`を`ThemeProvider`より外側に配置 |

#### 8.2.4.2 デバッグ手順

1. **ブラウザ開発者ツールのConsoleを確認**
   - Hydration警告の詳細を確認
   - エラースタックトレースから問題箇所を特定

2. **Network タブでリソース読み込みを確認**
   - CSSファイルの読み込み状況
   - JSバンドルの読み込み順序

3. **React Developer Toolsでコンポーネント状態を確認**
   - Props/Stateの値がSSR/CSRで一致しているか
   - Context値の伝播状況

### 8.2.5 実装のポイントまとめ

#### 8.2.5.1 重要な設定項目

1. **suppressHydrationWarning の適用**
   - `<html>` と `<body>` タグに設定
   - スタイル不一致の警告を抑制

2. **StyledEngineProvider の配置**
   - ThemeProvider より外側に配置
   - `injectFirst` プロパティで優先度制御

3. **クライアント状態の管理**
   - `useEffect` でクライアント判定
   - DOM/BOM API への安全なアクセス

#### 8.2.5.2 アーキテクチャ上の考慮点

- **段階的な機能有効化**: SSR対応の基本表示から徐々に機能を拡張
- **状態の分離**: サーバー側で利用できない状態は明確に分離
- **エラーハンドリング**: hydration失敗時の適切なフォールバック

### 8.2.6 参考リンク

- [React Router v7 Documentation](https://reactrouter.com/en/main)
- [MUI Server-Side Rendering Guide](https://mui.com/material-ui/guides/server-rendering/)
- [React Hydration Best Practices](https://react.dev/reference/react-dom/client/hydrateRoot)

---

このガイドは実際のプロダクション環境で発生した問題とその解決策をまとめたものです。類似のシステム開発時の参考としてご活用ください。
