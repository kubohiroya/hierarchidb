# @hierarchidb/runtime-search-result-window

地図上部の検索フィールドからの検索結果を表示するためのフローティングウィンドウコンポーネント。`@hierarchidb/ui-floating-window`を内部的に使用し、ツリールートごとの状態永続化機能を提供します。

## 機能

### 検索結果表示機能
- **コンパクト表形式**: StyleMapノード名、行番号、データ内容を表形式で表示
- **複数選択**: Shift/Cmd+クリックによる複数行選択機能
- **地図連携**: 行選択で地図の視野移動、ダブルクリックでフォーカス
- **データプレビュー**: StyleMapの元データを主要カラムで簡易表示
- **信頼度表示**: 検索マッチングの信頼度を色分けで表示

### ウィンドウ管理機能
- **フローティング表示**: ドラッグ可能なフローティングウィンドウ
- **リサイズ対応**: ウィンドウサイズの動的変更
- **最小化/復元**: ワンクリックでの最小化・復元
- **永続化**: ツリールートごとのウィンドウ状態保存

### 地図強調表示機能
- **2種類の強調表示**: 検索マッチ（塗りつぶし色）と選択状態（線色・幅）
- **リアルタイム更新**: 選択変更時の即座な地図反映
- **カスタムスタイル**: 強調色・透明度の設定可能

### 検索統合機能  
- **StyleMap連携**: PropertyResolverによる仮想プロパティ検索
- **行レベル検索**: データ行単位での精密な検索結果表示
- **多言語対応**: 仮想プロパティによる多言語キーワード検索

## インストール

```bash
pnpm add @hierarchidb/runtime-search-result-window
```

## 基本的な使用方法

```tsx
import { SearchResultWindow } from '@hierarchidb/runtime-search-result-window';
import type { SearchResult } from '@hierarchidb/runtime-search-result-window';

function MapSearchInterface({ treeId }) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleResultSelect = (result: SearchResult) => {
    // 地図上の該当要素にフォーカス
    mapService.focusOnNode(result.nodeId);
  };

  const handleClose = () => {
    setSearchResults([]);
  };

  const handleRefresh = () => {
    // 検索を再実行
    performSearch();
  };

  return (
    <SearchResultWindow
      treeId={treeId}
      results={searchResults}
      isLoading={isLoading}
      onResultSelect={handleResultSelect}
      onClose={handleClose}
      onRefresh={handleRefresh}
    />
  );
}
```

## プロパティ

### SearchResultWindowProps

| プロパティ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `treeId` | `TreeId` | - | ツリーID（永続化キーとして使用）（必須） |
| `results` | `SearchResult[]` | - | 検索結果配列（必須） |
| `isLoading` | `boolean` | `false` | ローディング状態 |
| `onResultSelect` | `(result: SearchResult) => void` | - | 結果選択時のコールバック |
| `onClose` | `() => void` | - | ウィンドウ閉じる時のコールバック |
| `onRefresh` | `() => void` | - | 更新ボタンクリック時のコールバック |

### SearchResult

```typescript
interface SearchResult {
  nodeId: NodeId;                    // ノードID
  nodeName: string;                  // ノード名
  nodeType: string;                  // ノードタイプ
  matchedProperty: string;           // マッチしたプロパティ名
  matchedValue: string;              // マッチした値
  confidence: number;                // 信頼度 (0-1)
  parentPath: string[];              // 親フォルダパス
  // StyleMapデータ関連
  styleMapNodeId?: NodeId;           // マッチしたStyleMapノードのID
  styleMapNodeName?: string;         // StyleMapノード名
  rowIndex?: number;                 // マッチした行のインデックス（0ベース）
  rowData?: Record<string, any>;     // その行の元データ
  displayColumns?: string[];         // 簡易表示用の主要カラム名
}
```

## コンポーネント

### SearchResultTable

StyleMapデータに最適化されたコンパクト表形式の検索結果表示:

```tsx
import { SearchResultTable } from '@hierarchidb/runtime-search-result-window';

function CompactSearchResults({ results }) {
  const [selectedResults, setSelectedResults] = useState(new Set<NodeId>());

  const handleResultSelect = (result: SearchResult, isMultiSelect: boolean) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (isMultiSelect) {
        newSet.has(result.nodeId) 
          ? newSet.delete(result.nodeId) 
          : newSet.add(result.nodeId);
      } else {
        newSet.clear();
        newSet.add(result.nodeId);
      }
      return newSet;
    });
  };

  const handleMapFocus = (result: SearchResult) => {
    mapService.focusOnLocation(result.nodeId);
  };

  return (
    <SearchResultTable
      results={results}
      selectedResults={selectedResults}
      onResultSelect={handleResultSelect}
      onMapFocus={handleMapFocus}
    />
  );
}
```

### MapHighlightProvider

地図上の強調表示を管理するプロバイダー:

```tsx
import { MapHighlightProvider, useMapHighlightContext } from '@hierarchidb/runtime-search-result-window';

function MapWithHighlight({ mapInstance }) {
  return (
    <MapHighlightProvider 
      mapInstance={mapInstance}
      initialStyles={{
        searchMatch: { fillColor: '#FFE082', fillOpacity: 0.6 },
        selection: { strokeColor: '#1976D2', strokeWidth: 3, strokeOpacity: 0.9 }
      }}
    >
      <SearchResultWindow />
      <MapComponent />
    </MapHighlightProvider>
  );
}

function SearchResultWindow() {
  const { setSearchMatched, setSelected } = useMapHighlightContext();
  
  const handleSearch = (results: SearchResult[]) => {
    const matchedNodeIds = results.map(r => r.nodeId);
    setSearchMatched(matchedNodeIds);
  };

  const handleSelect = (selectedResults: SearchResult[]) => {
    const selectedNodeIds = selectedResults.map(r => r.nodeId);
    setSelected(selectedNodeIds);
  };

  return (/* ... */);
}
```

## フック

### useSearchResultWindow

検索結果ウィンドウの状態管理フック：

```tsx
import { useSearchResultWindow } from '@hierarchidb/runtime-search-result-window';

function SearchInterface({ treeId }) {
  const {
    windowState,
    results,
    isLoading,
    actions: {
      showResults,
      hideWindow,
      selectResult,
      refreshResults
    }
  } = useSearchResultWindow({
    treeId,
    searchService: virtualPropertySearchService,
  });

  // 検索実行
  const performSearch = async (keyword: string) => {
    const results = await virtualPropertySearchService.search(keyword);
    showResults(results);
  };

  return (
    <div>
      <input
        onChange={(e) => performSearch(e.target.value)}
        placeholder="検索..."
      />
      {windowState.isVisible && (
        <SearchResultWindow
          treeId={treeId}
          results={results}
          isLoading={isLoading}
          onResultSelect={selectResult}
          onClose={hideWindow}
          onRefresh={refreshResults}
        />
      )}
    </div>
  );
}
```

### useMultiSelection

複数選択機能を提供するフック:

```tsx
import { useMultiSelection } from '@hierarchidb/runtime-search-result-window';

function SearchInterface({ results }) {
  const {
    selectedResults,
    selectedResultItems,
    handleResultSelect,
    handleMapFocus,
    selectAll,
    clearSelection,
  } = useMultiSelection({
    results,
    onSelectionChange: (selected) => {
      console.log(`${selected.length} items selected`);
    },
    onMapFocus: (result) => {
      mapService.focusOnNode(result.nodeId);
    },
  });

  return (
    <div>
      <button onClick={selectAll}>全選択</button>
      <button onClick={clearSelection}>選択解除</button>
      <SearchResultTable
        results={results}
        selectedResults={selectedResults}
        onResultSelect={handleResultSelect}
        onMapFocus={handleMapFocus}
      />
    </div>
  );
}
```

### useMapHighlight

地図強調表示機能のフック:

```tsx
import { useMapHighlight } from '@hierarchidb/runtime-search-result-window';

function MapController({ mapInstance }) {
  const {
    highlightState,
    setSearchMatched,
    setSelected,
    clearAll,
    updateStyles,
  } = useMapHighlight({
    mapInstance,
    initialStyles: {
      searchMatch: { fillColor: '#FFEB3B', fillOpacity: 0.5 },
      selection: { strokeColor: '#2196F3', strokeWidth: 2, strokeOpacity: 1.0 },
    },
  });

  const handleSearchResults = (results: SearchResult[]) => {
    const nodeIds = results.map(r => r.nodeId);
    setSearchMatched(nodeIds);
  };

  const handleSelection = (selectedResults: NodeId[]) => {
    setSelected(selectedResults);
  };

  return (
    <div>
      <button onClick={() => updateStyles({
        searchMatch: { fillColor: '#FF5722', fillOpacity: 0.7 }
      })}>
        ハイライト色変更
      </button>
      <button onClick={clearAll}>強調表示クリア</button>
      <div>選択中: {highlightState.selected.size}件</div>
      <div>検索マッチ: {highlightState.searchMatched.size}件</div>
    </div>
  );
}
```

### useWindowPersistence

ウィンドウ状態の永続化フック:

```tsx
import { useWindowPersistence } from '@hierarchidb/runtime-search-result-window';

function PersistentSearchWindow({ treeId }) {
  const {
    windowState,
    saveState,
    loadState,
    clearState
  } = useWindowPersistence(treeId);

  // 自動保存
  useEffect(() => {
    saveState(windowState);
  }, [windowState, saveState]);

  return (
    <SearchResultWindow
      treeId={treeId}
      // ... other props
    />
  );
}
```

## サービス

### WindowPersistenceService

ウィンドウ状態の永続化サービス：

```typescript
import { WindowPersistenceService } from '@hierarchidb/runtime-search-result-window';

// サービスのインスタンス化
const persistenceService = new WindowPersistenceService();

// 状態保存
await persistenceService.saveWindowState(treeId, {
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
  isMinimized: false,
  isVisible: true,
  treeId,
  lastSearchKeyword: 'tokyo',
  selectedNodeId: 'node-123' as NodeId,
});

// 状態読み込み
const savedState = await persistenceService.loadWindowState(treeId);

// 状態削除
await persistenceService.deleteWindowState(treeId);
```

## 永続化仕様

### データ保存場所
- **メディア**: IndexedDB (EphemeralDB)
- **テーブル**: `searchResultWindowStates`
- **キー**: `treeId` (TreeIdベース)

### 保存データ構造

```typescript
interface SearchResultWindowState extends WindowState {
  treeId: TreeId;               // ツリーID
  lastSearchKeyword?: string;   // 最後の検索キーワード
  selectedNodeId?: NodeId;      // 最後に選択したノードID
  // WindowStateから継承
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isVisible: boolean;
}
```

### 永続化タイミング
- ウィンドウ位置・サイズ変更時（デバウンス: 500ms）
- 最小化/復元時（即座）
- ウィンドウ閉じる時（即座）
- 検索結果選択時（即座）

## 統合例

### 地図アプリケーションでの使用

```tsx
import { SearchResultWindow } from '@hierarchidb/runtime-search-result-window';
import { VirtualPropertySearchService } from '@hierarchidb/virtual-property-search';

function MapApplication({ treeId }) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showWindow, setShowWindow] = useState(false);

  const searchService = new VirtualPropertySearchService();

  const handleSearch = async (keyword: string) => {
    setSearchKeyword(keyword);
    
    if (keyword.length < 2) {
      setShowWindow(false);
      return;
    }

    const results = await searchService.searchByVirtualProperty({
      keyword,
      searchMode: 'contains',
      virtualProperties: ['search', 'search_ja', 'search_en'],
      limit: 100,
    });

    setSearchResults(results.results);
    setShowWindow(true);
  };

  const handleResultSelect = (result: SearchResult) => {
    // 地図上でノードをフォーカス
    mapController.focusNode(result.nodeId);
    
    // ツリーでノードを選択
    treeController.selectNode(result.nodeId);
    
    // 詳細パネルを表示
    detailPanel.showNode(result.nodeId);
  };

  return (
    <div className="map-container">
      <div className="search-bar">
        <input
          type="text"
          placeholder="地図要素を検索..."
          value={searchKeyword}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      
      <div className="map-view">
        {/* 地図コンポーネント */}
      </div>

      {showWindow && (
        <SearchResultWindow
          treeId={treeId}
          results={searchResults}
          onResultSelect={handleResultSelect}
          onClose={() => setShowWindow(false)}
          onRefresh={() => handleSearch(searchKeyword)}
        />
      )}
    </div>
  );
}
```

### プロジェクト横断検索

```tsx
function ProjectWideSearch({ projectId }) {
  const handleMultiTypeSearch = async (keyword: string) => {
    // shape, location, routeを串刺し検索
    const results = await Promise.all([
      searchService.searchNodeType(keyword, 'shape-plugin'),
      searchService.searchNodeType(keyword, 'location-plugin'),
      searchService.searchNodeType(keyword, 'route-plugin'),
    ]);

    const allResults = results.flat().sort((a, b) => b.confidence - a.confidence);
    
    return allResults;
  };

  return (
    <SearchResultWindow
      treeId={projectId}
      results={await handleMultiTypeSearch(searchKeyword)}
      onResultSelect={(result) => {
        // 該当プラグインの詳細画面を開く
        pluginManager.openNodeDetail(result.nodeId);
      }}
    />
  );
}
```

## デザイン仕様

### ウィンドウ外観
- **デフォルトサイズ**: 400px × 450px（表形式に最適化）
- **最小サイズ**: 320px × 250px
- **最大サイズ**: 画面サイズの80%
- **デフォルト位置**: 地図右上 (右端から50px, 上端から80px)

### 表形式レイアウト
- **選択**: 40px幅のチェックボックス
- **StyleMap**: 150px幅のノード名（省略表示）
- **行**: 60px幅の行番号（1ベース表示）
- **データ**: 200px幅の主要カラムチップ表示
- **信頼度**: 50px幅のパーセンテージ表示

### 強調表示スタイル
- **検索マッチ**: 黄色系塗りつぶし (`#FFE082`, 60%透明度)
- **選択状態**: 青色系線強調 (`#1976D2`, 3px幅, 90%透明度)
- **複数選択**: Shift/Cmdキーによる範囲・追加選択対応

## パフォーマンス

### 最適化機能
- **仮想化リスト**: 大量結果の効率的表示
- **検索デバウンス**: 過度な検索クエリの抑制
- **結果キャッシュ**: 同じ検索の高速化
- **遅延読み込み**: 詳細情報の必要時取得

### 制限事項
- 最大表示件数: 1000件
- 検索タイムアウト: 10秒
- ウィンドウ数制限: ツリーあたり1つ

## 関連パッケージ

- `@hierarchidb/ui-floating-window` - ベースとなるフローティングウィンドウ
- `@hierarchidb/virtual-property-search` - 仮想プロパティ検索エンジン
- `@hierarchidb/property-resolver-plugin` - プロパティ変換ルール定義