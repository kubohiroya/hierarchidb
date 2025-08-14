# 5. ベースモジュール

本章では、hierarchiidb のコアを構成するベースモジュール群について説明する。  

## 5.1 ベースモジュール概要と依存関係

ベースモジュールは大きく分けて **Cloudflare上で稼働するサーバサイドモジュール群**（5.2）と、**GitHub Pages上で稼働するクライアントサイドモジュール群**（5.3以降）で構成される。
本プロジェクトは以下のモジュールで構成される。

- サーバサイドモジュール
  - **bff**: OAuth2 認証の仲介 (Google, Microsoft, GitHub)。Cloudflare Worker 上で動作。
  - **cors-proxy**: 外部オープンデータ/API への CORS 制約回避プロキシ。bff 認証必須。
- クライアントサイドモジュール
  - **core**: 基本データモデル。アプリ全体で共通する型定義、列挙型。
  - **api**: UI層 と Worker層 を Comlink 経由で接続するためのインターフェイス定義。
  - **worker**: Worker層の実装。DB 操作、コマンド実行、Pub/Sub 管理を担当。
  - **UIモジュール群**（機能別に分割）:
    - **ui-core**: 基本UIコンポーネント、MUI、テーマシステム
    - **ui-auth**: 認証・認可、OAuth2/OIDC関連
    - **ui-routing**: ルーティング、React Router関連
    - **ui-i18n**: 国際化、多言語対応
    - **ui**: 上記を統合したアプリケーション固有のUI実装
  - **app**: アプリ全体を構成する。また、拡張モジュールを組み込む。

**依存方向:**
```
ui → ui-core, ui-auth, ui-routing, ui-i18n → api → core
ui-auth, ui-routing → ui-core
worker → core
app → (ui, worker, core)
```
---

## 5.2 サーバサイドモジュール概要

Cloudflareにデプロイして運用するサーバ再サイドモジュール

### 5.2.1 bffモジュール（Backends For Frontends）

#### 目的
- クライアント（UI層）と外部APIサービス（Google/Microsoft/GitHub）間のOAuth2認証を仲介。
- クライアントからはBFF経由でのみ外部APIにアクセスできるようにする。
- UI側で認証処理や機密キー管理を行わないようにし、セキュリティを確保。

#### 機能要件
- OAuth2 認証フローの開始/コールバックハンドリング。
- アクセストークン・リフレッシュトークンの安全な管理（Cloudflare KV/Secrets）。
- 認証済みユーザのセッション発行（短期トークン）。
- 認証状態確認APIの提供。

#### 実装上のポイント
- 認証結果はHTTP-onlyクッキーで返却（XSS対策）。
- 認証フローは外部リダイレクトを伴うため、stateパラメータを利用してCSRF防止。
- Cloudflare Workerとして実装し、軽量・低レイテンシで動作させる。
- **設定値管理方針**
    - クライアントID・リダイレクトURLなどの非機密設定値は、プロジェクトルートの `.env` ファイルで管理する。
    - クライアントシークレットや署名鍵などの機密情報は、CloudflareのSecrets機能（`wrangler secret put`）を用いて登録し、Worker内で参照する。
    - `.env` ファイルは `.gitignore` に必ず登録する。

---

### 5.2.2 cors-proxyモジュール

#### 目的
- 外部のオープンデータ/APIを利用する際に、CORS制約を回避する。
- 利用時にはbffモジュールによる認証を必須とし、不正利用を防ぐ。

#### 機能要件
- 任意の外部URLへのHTTPリクエストを代理送信。
- クエリ/ヘッダ/メソッド/ボディの透過的転送。
- レスポンスヘッダの `Access-Control-Allow-Origin` を適切に設定。
- 許可リスト（ホワイトリスト）によるアクセス制限。

#### 実装上のポイント
- 大容量レスポンスやストリーミングはサポートしない（パフォーマンス確保）。
- キャッシュ制御を適切に設定し、同一リソースの繰り返し取得を最適化。
- リクエスト先URLは事前定義または署名付きで許可。
- **設定値管理方針**
    - API利用時の許可リストURLやCORS設定値は `.env` に記載（非機密のみ）。
    - 認証トークンや署名用秘密鍵は Cloudflare Secrets に保存し、Worker内で利用。


**設定値管理方針:**
- `.env`: 非機密設定（クライアントID、リダイレクトURLなど）
- Cloudflare Secrets (`wrangler secret put`): 機密情報（クライアントシークレット、署名鍵など）

---
## 5.3 クライアントサイドモジュール概要

### 5.3.1 coreモジュール

#### 目的
- アプリ全体で共通して利用する型定義・定数・ユーティリティ関数を提供。
- TreeやTreeNodeの基本スキーマ、コマンド型、DBスキーマ定義を含む。

#### 機能要件
- Dexieスキーマ定義（CoreDB/EphemeralDB）。
- Tree/TreeNode/TreeRootState/TreeViewStateの型定義。
- コマンド種別・プロパティの型安全な定義。
- 共通ユーティリティ（ID生成、時刻取得、名前正規化）。

#### 実装上のポイント
- `Entity` 用語は使用せず、シンプルな型名を採用（例：TreeNode）。
- 型と定数はexportし、ui/workerモジュール双方で利用可能にする。
- DBスキーマ変更は必ずバージョン管理し、マイグレーション関数を実装。

---

### 5.3.2 apiモジュール

#### 目的
- UI層とWorker層間の通信契約を定義する。
- Comlink経由で呼び出せる型安全な関数インターフェイスを提供。

#### 機能要件
- UI→Workerの要求関数（CRUDコマンド、購読開始/終了、検索など）。
- Worker→UIの通知関数（購読ノード更新、削除通知、Undo/Redo結果など）。
- 引数・戻り値はすべてcoreモジュールの型を利用。

#### 実装上のポイント
- API追加は後方互換を保つ形でのみ行う。
- 破壊的変更が必要な場合はメジャーバージョンアップ。
- 関数名は動詞+目的語の命名（例：`createNode`, `subscribeTree`）。

---

### 5.3.3 workerモジュール

#### 目的
- 実際のDB操作・コマンド処理を担当するバックエンド的役割。
- UI層からのAPI呼び出しを順序づけ、CoreDB/EphemeralDBを更新。

#### 機能要件
- コマンドの実行（物理コマンド、論理コマンドの展開）。
- Undo/Redo管理（グローバル一意seq、リングバッファ保持）。
- DB購読の開始/終了管理と差分通知。
- 楽観的ロックによる競合検出。

#### 実装上のポイント
- UI層から直接DB操作は禁止。すべてAPI経由で。
- DB更新後は差分のみを購読者に通知（changed fields最小化）。
- EphemeralDBは短期保存専用でスナップショットや一時データに利用。

---

### 5.3.4 UIモジュール群

UIモジュールは機能ごとに以下の5つのパッケージに分割されている：

#### 5.3.4.1 ui-coreモジュール

##### 目的
- 基本的なUIコンポーネントとテーマシステムを提供。
- Material UI（MUI）をベースとした共通コンポーネント群。

##### 機能要件
- MUIコンポーネントのラッパーと拡張。
- テーマ管理とカスタマイズ機能。
- アイコンシステムとアニメーション。
- 通知システム（Toast、Notification）。

##### 含まれるもの
- Material UI関連（@mui/material、@mui/icons-material、@mui/x-date-pickers）
- スタイリング（@emotion/react、@emotion/styled）
- 基本コンポーネント（Button、Menu、Sidebar、Loading、ErrorBoundary等）
- テーマシステム（/theme、/themes）
- アイコン定義（/icons）
- ユーティリティ関数（/utils）

#### 5.3.4.2 ui-authモジュール

##### 目的
- 認証・認可機能を提供。
- OAuth2/OIDC認証のUIコンポーネント。

##### 機能要件
- 複数認証プロバイダー対応（Google、Microsoft、GitHub）。
- 認証状態管理とコンテキスト提供。
- ユーザー情報表示（アバター、ログインボタン）。

##### 含まれるもの
- OIDC Client（oidc-client-ts、react-oidc-context）
- OAuth関連（@react-oauth/google）
- 認証コンポーネント（AuthPanel、AuthProvider、AuthErrorBoundary）
- 認証フック（useAuthBFF、useAuthGoogle、useAuthOIDC等）
- ユーザーコンポーネント（UserLoginButton、UserAvatar、Gravatar）

#### 5.3.4.3 ui-routingモジュール

##### 目的
- ルーティングとナビゲーション機能を提供。
- React Routerベースのルーティングシステム。

##### 機能要件
- ルート定義と管理。
- ナビゲーションコンポーネント。
- URLヘルパー関数。

##### 含まれるもの
- React Router（react-router、react-router-dom）
- ルーティング設定（/config/routing.ts）
- ナビゲーションコンポーネント（NavLinkMenu、LinkButton）

#### 5.3.4.4 ui-i18nモジュール

##### 目的
- 国際化（i18n）機能を提供。
- 多言語対応のUIコンポーネント。

##### 機能要件
- 言語切り替え機能。
- 翻訳リソース管理。
- ブラウザ言語の自動検出。

##### 含まれるもの
- i18next関連（i18next、react-i18next）
- 言語検出（i18next-browser-languagedetector）
- HTTPバックエンド（i18next-http-backend）
- 言語プロバイダー（LanguageProvider）

#### 5.3.4.5 uiモジュール（統合）

##### 目的
- 上記すべてのUIモジュールを統合。
- アプリケーション固有のUIロジックを実装。

##### 機能要件
- ツリー表示・編集・Undo/Redo・検索・フィルタリング機能。
- 複数TreeViewの同時表示。
- 各TreeViewでのノード展開/折りたたみ状態管理（TreeRootState）。
- コマンド発行・結果反映（Comlink API経由）。

##### 実装上のポイント
- フォーム入力はreact-hook-formで一元管理。
- 展開ノードは遅延ロードし、大量描画を避ける（仮想化）。
- 各UIモジュールの機能を組み合わせて統合的なUIを構築。

##### 依存関係
```
ui → ui-core, ui-auth, ui-routing, ui-i18n
ui-auth → ui-core
ui-routing → ui-core  
ui-i18n → (独立)
```

---

### 5.3.5 appモジュール

#### 目的
- アプリ全体を構成し、必要な拡張モジュールを組み込む。
- ルートエントリーポイントとしてUIのルーティングを定義。

#### 機能要件
- core/api/worker/uiの初期化。
- 拡張モジュールの登録と依存関係解決。
- 環境設定（config）の読込。

#### 実装上のポイント
- エントリーポイントは1つ（`entry.client.tsx`）。
- モジュール初期化順序は core → api → worker/ui → 拡張。


------
## 5.4 データモデル定義
### 5.4.1 coreモジュールにおけるデータモデル定義

Worker層、UI層、app で用いられるデータモデル定義

#### 5.4.1.1 基本データモデル
```ts
type UUID = string;
type TreeId = string;
type TreeRootNodeType = "SuperRoot" | "Root" | "TrashRoot";
type TreeNodeType = TreeRootNodeType | "folder" | "file";
type TreeRootNodeId = UUID;
type TreeNodeId = TreeRootNodeId | UUID;
type Timestamp = number;
```

#### 5.4.1.2 ツリー構造関係データモデル

```ts
type Tree = {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;       // Root
  treeTrashRootNodeId: TreeRootNodeId;  // TrashRoot
  superRootNodeId: TreeRootNodeId;      // e.g., `superroot:${treeId}`
};
// Root/TrashRoot の parentTreeNodeId は必ず superRootNodeId
// SuperRoot の TreeNode 実体は存在しない（内部専用・UI 非表示）

type TreeNodeBase = {
  treeNodeType: TreeNodeType;
  treeNodeId: TreeNodeId;               
  parentTreeNodeId: TreeNodeId;         
  name: string;                         
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp; 
  version: number;
};

type DescendantProperties = {
  hasChild: boolean;
};

type ReferenceProperties = {
  references?: TreeNodeId[];
};

type TrashItemProperties = {
  originalName: string;
  originalParentTreeNodeId: TreeNodeId;
  removedAt: Timestamp;
};

type TreeNode =
& TreeNodeBase
& ({} | ReferenceProperties)
& ({} | TrashItemProperties);
```

- **TreeNodeは兄弟名がユニーク**: 同一 parentTreeNodeId 配下で name はユニーク。

#### 5.4.1.3 ツリー状態データモデル
```ts
type TreeRootState = {
  treeId: TreeId;
  treeRootNodeType: TreeRootNodeType;
  expanded: true | Record<TreeNodeId, boolean>;
};
```
* expandedがtrueの場合には、すべてのノードが開いた状態であることを表す。
* expandedがRecordの場合には、エントリーのメンバーのノードの開閉状態を表すものとする。

#### 5.4.1.4 ツリー開閉状態の変化通知データモデル
```ts
type ExpandedStateChanges = {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  pageNodeId: TreeNodeId;
  changes: true | Record<TreeNodeId, boolean|null>;
  version: number;
}
```
* changesの値が、expandedの値にマージされる。
* changesのRecordの値がnullの場合は、当該ノードが削除されたことを表すものとする。

#### 5.4.1.5 ツリー状態変化通知データモデル
```ts
type SubTreeChanges = {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  pageNodeId: TreeNodeId;
  changes: Record<TreeNodeId, (TreeNodeWithChildren|null)>;
  version: number;
}
```
* changesのキーとなるTreeNodeIdは、pageNodeIdのノード自身およびその直系の先祖ノードを含むものとする。また、pageNodeIdのノードの下位のノードのうち開状態のノードを含むものとする。
* changesの値が、UI側で保持されるツリー状態の値にマージされる。
* changesのRecordの値がnullの場合は、当該ノードが削除されたことを表すものとする。

----

### 5.4.2 Workerモジュールにおけるデータベース定義

Worker層におけるツリー格納用のデータモデル

#### 5.4.3.1 CoreDB（長命・原子性必要）
```ts
import Dexie, { Table } from 'dexie';

export type TreeRow = Tree;
export type TreeNodeRow = TreeNode; 
export type TreeRootStateRow = TreeRootState;

export class CoreDB extends Dexie {
  trees!: Table<TreeRow, string>;
  nodes!: Table<TreeNodeRow, string>;
  rootStates!: Table<TreeRootStateRow, [string, string]>;

  constructor(name: string) {
    super(`${name}-CoreDB`);
    this.version(1).stores({
      trees: '&treeId, treeRootNodeId, treeTrashRootNodeId, superRootNodeId',
      nodes: [
        '&treeNodeId',
        'parentTreeNodeId',
        '&[parentTreeNodeId+name]',
        '[parentTreeNodeId+updatedAt]',
        'removedAt',
        'originalParentTreeNodeId',
        '*references'
      ].join(', '),
      rootStates: '&[treeId+treeRootNodeType], treeId, treeRootNodeId'
    });
  }
}
```

##### インデックス設計理由（重要ポイント）
* &treeNodeId … ノード主キー。
* parentTreeNodeId … 子一覧の取得・移動可否判定で高頻度に使用。
* &[parentTreeNodeId+name] … 兄弟名の一意性（重複名禁止）を安全に担保。
* [parentTreeNodeId+updatedAt] … 展開中枝の差分購読（指定Timestamp以降の更新）を効率化。
* removedAt, originalParentTreeNodeId … ゴミ箱の時系列表示と復元先特定に最適。
* referencesは、アプリで利用される
 


#### 5.4.2.2 EphemeralDB（短命・高頻度）
```ts
export type WorkingCopyRow = WorkingCopy;
export type TreeViewStateRow = TreeViewState;

export class EphemeralDB extends Dexie {
  workingCopies!: Table<WorkingCopyRow, string>;
  views!: Table<TreeViewStateRow, string>;

  constructor(name: string) {
    super(`${name}-EphemeralDB`);
    this.version(1).stores({
      workingCopies:
        '&workingCopyId, workingCopyOf, parentTreeNodeId, updatedAt',
      views:
        '&treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]'
    });
  } 
}
```

インデックス設計理由
* &[treeId+treeRootNodeType] … ツリー×ルート種別で 一意 に状態を特定。
* treeRootNodeId … ルートノードIDから逆引きして状態を素早く得る用途。

代表的なクエリと対応インデックス（実装目安）
* 子ノード一覧
nodes.where('parentTreeNodeId').equals(pid)
→ parentTreeNodeId

* 兄弟名のユニークチェック
nodes.get({ parentTreeNodeId: pid, name })
→ &[parentTreeNodeId+name]（ユニークなので get 一発）

* 展開中枝の差分購読（Timestamp 以降）
nodes.where('[parentTreeNodeId+updatedAt]').between([pid, ts], [pid, Dexie.maxKey])
→ [parentTreeNodeId+updatedAt]

* WorkingCopy → 元の探索
nodes.where('workingCopyOf').equals(nodeId)
→ workingCopyOf

* Trash 一覧の時系列
nodes.where('removedAt').above(0).reverse()
→ removedAt

* 参照整合性（remove前チェック）
nodes.where('referredBy').equals(targetId)（multiEntry）
→ *referredBy

* ルート状態の取得
rootStates.get([treeId, 'Root']) / rootStates.get([treeId, 'TrashRoot'])
→ &[treeId+treeRootNodeType]

### 5.4.3 API層におけるPub-Subモデル

* UIでは、URLパスとして"/t/:treeId/:pageTreeNodeId"のような表現により、「treeId」と「pageTreeNodeId」を指定して、そのページにおいて、ルートノード以下の木の全体ではなく、特定のノード以下の木の一部を「購読（subscribeSubTree）」して表示することができる。なお、同じ木を複数のタブで購読・表示でき、他のタブでの木の更新がリアルタイムで自動的に表示内容に反映されるものとする。
* Workerでは、ツリールートごとにノードの開閉状態を「expanded」プロパティで保持したものを永続化して管理している。これにより、開状態のノードの内容を、そのノードを含む部分木を購読しているUI向けに配信する。 
* Workerは、ノードの更新が行われるたびに、その更新されたノードが、いずれかのUIが購読しているpageNodeIdの直系の先祖ノードであるかどうかをチェックして、もし直系の先祖に該当する場合には、更新内容をそれらのUI向けに配信する。

```ts
// Worker exposed interface
export interface TreeObservableService {

  // ---- subscription ----
  subscribeSubTree(pageTreeNodeId: TreeNodeId, 
                   notifyExpandedChangesCallback: (changes: ExpandedStateChanges) => void, 
                   notifySubTreeChangesCallback: (changes: SubTreeChanges) => void
                   ): Promise<{
                     initialSubTree: Promise<SubTreeChanges>,
                     unsubscribeSubTree: ()=>void
  }>;

  toggleNodeExpanded(pageTreeNodeId: TreeNodeId): Promise<void>;
  
  // ---- query ----
  listChildren(parentId: TreeNodeId, doExpandNode?: boolean): Promise<SubTreeChanges>; // ソート: name ASC（正規化済み）
  getAncestors(pageNodeId: TreeNodeId): Promise<TreeNode[]>;
  searchByNameWithDepth(rootNodeId: TreeNodeId, query: string, opts: {
    maxDepth: number; maxVisited?: number;
  }): Promise<TreeNode[]>;
  
  // (略)

```
### 5.4.4 API層におけるコマンド

- **コマンド**: Worker内で保持されたデータベース内容に対する操作のうち、主として更新系の操作ひとつを、Undo/Redo可能な単位としたもの。
- **コマンドバッファ**: コマンドの履歴（操作・逆操作の内容）を保持する。capacity = 200（調整可）のリングバッファとして実装され、古い履歴から破棄する。メモリ上に保持するので、再読み込みで消える（仕様として許容）
- **グローバル seq**: 変更系API実行の成功時にWorkerが受理順に採番したものを返す。失敗時は errorCode と message を含む例外を投げる（NAME_NOT_UNIQUE / STALE_VERSION / HAS_INBOUND_REFS / ILLEGAL_RELATION など）
- **Undo-as-a-Command**: 逆操作を新規コマンドとしてコマンドバッファにpushする。

#### 5.4.4.1 コマンド仕様

* すべてのコマンド（物理・論理）はスーパータイプとして groupId: UUID を持つ。
* 同一 groupId を持つ物理コマンド群が、1つの論理コマンドを構成する。
 
- 共通項目:
```ts
type CommandGroupId = UUID;
type CommandId = UUID;
type Seq = number;

interface CommandEnvelope<K extends string, P> {    
  commandId: CommandId;
  groupId: CommandGroupId;
  kind: K;
  payload: P;
  issuedAt: Timestamp;
  sourceViewId?: string;
  onNameConflict?: 'error' | 'auto-rename';
}
```

#### 5.4.4.2 更新系論理コマンド

* createNode
    * createWorkingCopyForCreate（Undo非対象）
      新規 treeNodeId を発行し、その値を workingCopyOf にもセット。
    * discardWorkingCopyForCreate（Undo非対象）
    * commitWorkingCopyForCreate（Undo対象）

* updateNode
    * createWorkingCopy（Undo非対象）
      編集対象ノードをスプレッド構文でシャローコピーし、treeNodeId を新規発行で上書き。
      workingCopyOf には編集対象ノードの treeNodeId をセットし、copiedAt に Date.now() をセット。
    * discardWorkingCopy（Undo非対象）
    * commitWorkingCopy（Undo対象）


```ts
// Worker exposed interface
export interface TreeMutationService {

  // ---- working copy ----
  createWorkingCopyForCreate(cmd: CommandEnvelope<'createWorkingCopyForCreate', {
    workingCopyId: UUID;
    parentTreeNodeId: TreeNodeId;
    name: string; // 正規化前可（Workerで正規化）
    description?: string;
  }>): Promise<void>;

  createWorkingCopy(cmd: CommandEnvelope<'createWorkingCopy', {
    workingCopyId: UUID;
    sourceTreeNodeId: TreeNodeId;
  }>): Promise<void>;

  discardWorkingCopyForCreate(cmd: CommandEnvelope<'discardWorkingCopyForCreate', {
    workingCopyId: UUID;
  }>): Promise<void>;

  discardWorkingCopy(cmd: CommandEnvelope<'discardWorkingCopy', {
    workingCopyId: UUID;
  }>): Promise<void>;

  commitWorkingCopyForCreate(cmd: CommandEnvelope<'commitWorkingCopyForCreate', {
    workingCopyId: UUID;
    onNameConflict?: OnNameConflict; // 既定: 'auto-rename'
  }>): Promise<{ seq: Seq; nodeId: TreeNodeId }>;

  commitWorkingCopy(cmd: CommandEnvelope<'commitWorkingCopy', {
    workingCopyId: UUID;
    expectedUpdatedAt: Timestamp; // 楽観ロック（元ノード）
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq }>;
}
```

#### 5.4.4.3 更新系物理コマンド

* moveNodes
  移動（自己/子孫への移動禁止）
* duplicateNodes
  複製（新規ID発行、referredBy 未定義、自己/子孫への複製禁止）
* pasteNodes
  クリップボード貼り付け（新規ID発行、自己/子孫への貼り付け禁止）
* moveToTrash
  TrashRoot配下に移動（referredBy が空でない場合は失敗）
* permanentDelete
  TrashRoot配下から完全削除
* recoverFromTrash
  TrashRoot配下から復元（parentTreeNodeId を元に戻す）
* importNodes
  JSONインポート（新規ID発行）

```ts
  // ---- physical ops ----
  moveNodes(cmd: CommandEnvelope<'moveNodes', {
    nodeIds: TreeNodeId[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq }>;

  duplicateNodes(cmd: CommandEnvelope<'duplicateNodes', {
    nodeIds: TreeNodeId[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq; newNodeIds: TreeNodeId[] }>;

  pasteNodes(cmd: CommandEnvelope<'pasteNodes', {
    nodes: Record<TreeNodeId, TreeNode>; // クリップボード由来（新規ID採番）
    nodeIds: TreeNode[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq; newNodeIds: TreeNodeId[] }>;

  moveToTrash(cmd: CommandEnvelope<'moveToTrash', {
    nodeIds: TreeNodeId[];
  }>): Promise<{ seq: Seq }>;

  permanentDelete(cmd: CommandEnvelope<'permanentDelete', {
    nodeIds: TreeNodeId[];             // TrashRoot 配下限定
  }>): Promise<{ seq: Seq }>;

  recoverFromTrash(cmd: CommandEnvelope<'recoverFromTrash', {
    nodeIds: TreeNodeId[];
    toParentId?: TreeNodeId;           // 未指定なら originalParentTreeNodeId
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq }>;

  importNodes(cmd: CommandEnvelope<'importNodes', {
    nodes: Record<TreeNodeId, TreeNode>; // JSONファイル由来（新規ID採番）
    nodeIds: TreeNode[];
    toParentId: TreeNodeId;
    onNameConflict?: OnNameConflict;
  }>): Promise<{ seq: Seq; newNodeIds: TreeNodeId[] }>;

  // ---- undo/redo ----  ※ メモリ・リングバッファ
  undo(groupId: CommandGroupId): Promise<{ seq: Seq }>;
  redo(groupId: CommandGroupId): Promise<{ seq?: Seq; ok: boolean }>; // 競合なら ok=false
  
}

```

#### 5.4.4.4 非更新コマンド

* copyNodes
* exportNodes

```ts
export interface TreeQueryService {
  copyNodes(cmd: CommandEnvelope<'copyNodes', {
    nodeIds: TreeNodeId[];
  }>): Promise<{seq: Seq}>;
  
  exportNodes(cmd: CommandEnvelope<'exportNodes', {
    nodeIds: TreeNodeId[];
  }>): Promise<{seq: Seq}>;
}
```

### 5.4.5 UI層

#### 5.4.5.1 ツリー表示用データモデル

UI層におけるツリー表示用のデータモデル

```ts
type TreeViewState = {
  treeViewId: UUID;
  treeId: TreeId;
  treeRootNodeType: TreeRootNodeType;
  pageNodeId: TreeNodeId;
  selected: Set<TreeNodeId>;
  columnWidthRatio: number[];
  columnSort: (null|"asc"|"dec")[];
  treeNodes: Record<TreeNodeId, TreeNodeWithChildren>;
  expanded: Record<TreeNodeId, boolean>;
  version: number;
  updatedAt: Timestamp;
};
```

### 5.4.6 一貫性と制約

- **保存時正規化**: `normalize('NFC')(name).trim()`（case-sensitive）。
- **衝突処理**:
    - UI文脈: エラー (`onNameConflict = 'error'`)
    - DB保存文脈: 自動リネーム許容 (`'auto-rename'`)
- **参照整合性**: moveToTrash 対象に参照されているノードが含まれる場合は失敗。
- **クロスツリー禁止**: parentTreeNodeId の祖先は同一 SuperRoot 系である必要。
