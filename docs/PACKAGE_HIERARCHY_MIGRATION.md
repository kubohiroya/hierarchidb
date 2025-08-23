# Package Hierarchy Migration Plan

## 目的
パッケージ間の依存関係を明確化し、循環依存を防ぐため、階層的な命名規則とディレクトリ構造を導入する。

## 依存関係ルール

### 基本原則
1. **兄弟関係**: 弟（番号が大きい）→ 兄（番号が小さい）への依存のみ許可
2. **親子関係**: 親 → 子への依存のみ許可
3. **番号プレフィックス**: 依存順序を明確化（00が最下層、99が最上位）

## 新しいディレクトリ構造

```
packages/
├── 00-core/              # 最下層：型定義とユーティリティ
├── 01-api/               # APIインターフェース定義
├── 02-worker/            # Worker実装
├── 10-ui-foundation/     # UI基盤層
│   ├── theme/
│   ├── i18n/
│   └── core/
├── 11-ui-common/         # UI共通コンポーネント層
│   ├── auth/
│   ├── layout/
│   ├── navigation/
│   └── routing/
├── 12-ui-features/       # UI機能層
│   ├── treeconsole/
│   │   ├── 00-base/
│   │   ├── 01-parts/
│   │   │   ├── breadcrumb/
│   │   │   ├── toolbar/
│   │   │   ├── footer/
│   │   │   ├── speeddial/
│   │   │   ├── trashbin/
│   │   │   └── treetable/
│   │   └── 02-panel/
│   ├── import-export/
│   ├── file/
│   ├── guide/
│   └── monitoring/
├── 13-ui-client/         # Worker接続層
├── 20-plugins/           # プラグイン層
│   ├── basemap/
│   ├── stylemap/
│   ├── folder/
│   ├── project/
│   ├── import-export/
│   └── shapes/
├── 30-backend/           # バックエンド層
│   ├── bff/
│   └── cors-proxy/
└── 99-app/              # アプリケーション層（最上位）
```

## パッケージ名マッピング

### Core層 (00-09)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/core | @hierarchidb/core | packages/00-core |
| @hierarchidb/api | @hierarchidb/api | packages/01-api |
| @hierarchidb/worker | @hierarchidb/worker | packages/02-worker |

### UI Foundation層 (10)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/ui-theme | @hierarchidb/ui-foundation-theme | packages/10-ui-foundation/theme |
| @hierarchidb/ui-i18n | @hierarchidb/ui-foundation-i18n | packages/10-ui-foundation/i18n |
| @hierarchidb/ui-core | @hierarchidb/ui-foundation-core | packages/10-ui-foundation/core |

### UI Common層 (11)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/ui-auth | @hierarchidb/ui-common-auth | packages/11-ui-common/auth |
| @hierarchidb/ui-layout | @hierarchidb/ui-common-layout | packages/11-ui-common/layout |
| @hierarchidb/ui-navigation | @hierarchidb/ui-common-navigation | packages/11-ui-common/navigation |
| @hierarchidb/ui-routing | @hierarchidb/ui-common-routing | packages/11-ui-common/routing |
| @hierarchidb/ui-usermenu | @hierarchidb/ui-common-usermenu | packages/11-ui-common/usermenu |

### UI Features層 (12)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/ui-treeconsole-base | @hierarchidb/ui-features-treeconsole-base | packages/12-ui-features/treeconsole/00-base |
| @hierarchidb/ui-treeconsole-breadcrumb | @hierarchidb/ui-features-treeconsole-parts-breadcrumb | packages/12-ui-features/treeconsole/01-parts/breadcrumb |
| @hierarchidb/ui-treeconsole-toolbar | @hierarchidb/ui-features-treeconsole-parts-toolbar | packages/12-ui-features/treeconsole/01-parts/toolbar |
| @hierarchidb/ui-treeconsole-speeddial | @hierarchidb/ui-features-treeconsole-parts-speeddial | packages/12-ui-features/treeconsole/01-parts/speeddial |
| @hierarchidb/ui-treeconsole-treetable | @hierarchidb/ui-features-treeconsole-parts-treetable | packages/12-ui-features/treeconsole/01-parts/treetable |
| @hierarchidb/ui-treeconsole-footer | @hierarchidb/ui-features-treeconsole-parts-footer | packages/12-ui-features/treeconsole/01-parts/footer |
| @hierarchidb/ui-treeconsole-trashbin | @hierarchidb/ui-features-treeconsole-parts-trashbin | packages/12-ui-features/treeconsole/01-parts/trashbin |
| @hierarchidb/ui-import-export | @hierarchidb/ui-features-import-export | packages/12-ui-features/import-export |
| @hierarchidb/ui-file | @hierarchidb/ui-features-file | packages/12-ui-features/file |
| @hierarchidb/ui-guide | @hierarchidb/ui-features-guide | packages/12-ui-features/guide |
| @hierarchidb/ui-monitoring | @hierarchidb/ui-features-monitoring | packages/12-ui-features/monitoring |
| @hierarchidb/ui-tour | @hierarchidb/ui-features-tour | packages/12-ui-features/tour |
| @hierarchidb/ui-landingpage | @hierarchidb/ui-features-landingpage | packages/12-ui-features/landingpage |

### UI Client層 (13)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/ui-client | @hierarchidb/ui-client | packages/13-ui-client |

### 独立UIパッケージ層 (15)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/ui-accordion-config | @hierarchidb/ui-widgets-accordion-config | packages/15-ui-widgets/accordion-config |
| @hierarchidb/ui-country-select | @hierarchidb/ui-widgets-country-select | packages/15-ui-widgets/country-select |
| @hierarchidb/ui-csv-extract | @hierarchidb/ui-widgets-csv-extract | packages/15-ui-widgets/csv-extract |
| @hierarchidb/ui-datasource | @hierarchidb/ui-widgets-datasource | packages/15-ui-widgets/datasource |
| @hierarchidb/ui-dialog | @hierarchidb/ui-widgets-dialog | packages/15-ui-widgets/dialog |
| @hierarchidb/ui-lru-splitview | @hierarchidb/ui-widgets-lru-splitview | packages/15-ui-widgets/lru-splitview |
| @hierarchidb/ui-map | @hierarchidb/ui-widgets-map | packages/15-ui-widgets/map |
| @hierarchidb/ui-validation | @hierarchidb/ui-widgets-validation | packages/15-ui-widgets/validation |

### Plugin層 (20)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/plugin-basemap | @hierarchidb/plugin-basemap | packages/20-plugins/basemap |
| @hierarchidb/plugin-stylemap | @hierarchidb/plugin-stylemap | packages/20-plugins/stylemap |
| @hierarchidb/plugin-folder | @hierarchidb/plugin-folder | packages/20-plugins/folder |
| @hierarchidb/plugin-project | @hierarchidb/plugin-project | packages/20-plugins/project |
| @hierarchidb/plugin-import-export | @hierarchidb/plugin-import-export | packages/20-plugins/import-export |
| @hierarchidb/plugin-shapes | @hierarchidb/plugin-shapes | packages/20-plugins/shapes |
| @hierarchidb/plugin-spreadsheet | @hierarchidb/plugin-spreadsheet | packages/20-plugins/spreadsheet |

### Backend層 (30)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/bff | @hierarchidb/backend-bff | packages/30-backend/bff |
| @hierarchidb/cors-proxy | @hierarchidb/backend-cors-proxy | packages/30-backend/cors-proxy |

### App層 (99)
| 旧名 | 新名 | 新パス |
|------|------|--------|
| @hierarchidb/app | @hierarchidb/app | packages/99-app |

## 移行フェーズ

### Phase 1: ディレクトリ構造の作成（影響なし）
- 新しいディレクトリ構造を作成（既存と並行）
- 移行スクリプトの準備

### Phase 2: Core層の移行（最小影響）
- 00-core, 01-api, 02-workerを移行
- 最も依存されているパッケージから開始

### Phase 3: UI Foundation層の移行
- ui-theme, ui-i18n, ui-coreを移行
- 依存関係の更新

### Phase 4: UI Common層の移行
- auth, layout, navigation等を移行

### Phase 5: UI Features層の移行
- treeconsole関連の再構造化
- 兄弟依存の解消

### Phase 6: Plugin層とApp層の移行
- プラグインの移行
- アプリケーションの最終調整

### Phase 7: クリーンアップ
- 旧ディレクトリの削除
- CI/CDの更新
- ドキュメントの更新

## 依存関係の修正

### 現在の問題のある依存
1. `ui-treeconsole-base` → `ui-treeconsole-speeddial` (兄弟間逆依存)
   - 解決: speeddialをbaseに統合するか、共通部分を抽出

## 成功基準
- [ ] すべてのパッケージが新構造に移行完了
- [ ] 循環依存がゼロ
- [ ] ビルド順序が自動的に決定可能
- [ ] 型チェックがすべて通る
- [ ] テストがすべて通る
- [ ] アプリケーションが正常に動作する

## リスクと対策
- **リスク**: 大規模な変更による一時的な開発停止
- **対策**: 段階的移行とgitブランチの活用

- **リスク**: インポートパスの更新漏れ
- **対策**: 自動化スクリプトとTypeScriptコンパイラによる検証

- **リスク**: CI/CDの破損
- **対策**: 並行環境での事前テスト