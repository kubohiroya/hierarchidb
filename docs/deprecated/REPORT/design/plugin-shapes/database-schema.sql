-- ============================================================================
-- Plugin Shapes データベーススキーマ設計
-- 
-- 【信頼性レベル】:
-- 🟢 hierarchidb CoreDB/EphemeralDB アーキテクチャに準拠
-- 🟡 既存BaseMapプラグインのテーブル設計パターンから妥当な推測  
-- 🔴 eria-cartographパターンから推測した高度な機能
-- ============================================================================

-- ============================================================================
-- CoreDB Tables (永続化データ)
-- ============================================================================

-- 🟢 メインShapesエンティティテーブル
CREATE TABLE shapes (
    node_id TEXT PRIMARY KEY,              -- TreeNodeId (hierarchidb標準)
    name TEXT NOT NULL,                    -- 表示名
    description TEXT,                      -- 説明文
    geojson_data TEXT NOT NULL,            -- GeoJSON FeatureCollection (JSON文字列)
    layer_config TEXT NOT NULL,            -- レイヤー設定 (JSON)
    default_style TEXT NOT NULL,           -- デフォルトスタイル (JSON)
    data_source TEXT,                      -- データソース情報 (JSON)
    processing_options TEXT,               -- 処理オプション (JSON)
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    version INTEGER NOT NULL DEFAULT 1,
    
    -- 制約
    CONSTRAINT chk_geojson_valid CHECK (json_valid(geojson_data)),
    CONSTRAINT chk_layer_config_valid CHECK (json_valid(layer_config)),
    CONSTRAINT chk_default_style_valid CHECK (json_valid(default_style)),
    CONSTRAINT chk_data_source_valid CHECK (data_source IS NULL OR json_valid(data_source)),
    CONSTRAINT chk_processing_options_valid CHECK (processing_options IS NULL OR json_valid(processing_options))
);

-- 🟡 Shapesメタデータ・統計情報テーブル (検索・索引最適化用)
CREATE TABLE shapes_metadata (
    shapes_id TEXT PRIMARY KEY,           -- _shapes_buggy.node_id への外部キー
    feature_count INTEGER NOT NULL DEFAULT 0,
    total_vertices INTEGER NOT NULL DEFAULT 0,
    data_size INTEGER NOT NULL DEFAULT 0, -- bytes
    bounding_box TEXT NOT NULL,           -- [minX, minY, maxX, maxY] JSON配列
    geometry_types TEXT NOT NULL,         -- ['Point', 'Polygon', ...] JSON配列
    crs TEXT NOT NULL DEFAULT 'EPSG:4326',
    spatial_index TEXT,                   -- R-tree索引データ (JSON)
    last_processed INTEGER,               -- 最終処理時刻
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    -- 外部キー制約
    FOREIGN KEY (shapes_id) REFERENCES shapes(node_id) ON DELETE CASCADE,
    
    -- 制約
    CONSTRAINT chk_feature_count_positive CHECK (feature_count >= 0),
    CONSTRAINT chk_vertices_positive CHECK (total_vertices >= 0),
    CONSTRAINT chk_data_size_positive CHECK (data_size >= 0),
    CONSTRAINT chk_bounding_box_valid CHECK (json_valid(bounding_box)),
    CONSTRAINT chk_geometry_types_valid CHECK (json_valid(geometry_types))
);

-- 🟢 インデックス定義 (CoreDB)
CREATE INDEX idx_shapes_name ON shapes(name);
CREATE INDEX idx_shapes_updated_at ON shapes(updated_at DESC);
CREATE INDEX idx_shapes_metadata_feature_count ON shapes_metadata(feature_count DESC);
CREATE INDEX idx_shapes_metadata_data_size ON shapes_metadata(data_size DESC);
CREATE INDEX idx_shapes_metadata_crs ON shapes_metadata(crs);
CREATE INDEX idx_shapes_metadata_last_processed ON shapes_metadata(last_processed DESC);

-- ============================================================================
-- EphemeralDB Tables (一時データ・キャッシュ)
-- ============================================================================

-- 🟢 Working Copy テーブル (編集用一時コピー)
CREATE TABLE shapes_workingcopies (
    working_copy_id TEXT PRIMARY KEY,      -- UUID
    working_copy_of TEXT NOT NULL,         -- 元のshapes.node_id
    name TEXT NOT NULL,
    description TEXT,
    geojson_data TEXT NOT NULL,
    layer_config TEXT NOT NULL,
    default_style TEXT NOT NULL,
    data_source TEXT,
    processing_options TEXT,
    edit_history TEXT,                     -- 編集履歴 (JSON配列)
    is_dirty BOOLEAN NOT NULL DEFAULT FALSE,
    copied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    version INTEGER NOT NULL,
    
    -- 制約
    CONSTRAINT chk_wc_geojson_valid CHECK (json_valid(geojson_data)),
    CONSTRAINT chk_wc_layer_config_valid CHECK (json_valid(layer_config)),
    CONSTRAINT chk_wc_default_style_valid CHECK (json_valid(default_style)),
    CONSTRAINT chk_wc_edit_history_valid CHECK (edit_history IS NULL OR json_valid(edit_history))
);

-- 🟡 ベクトルタイルキャッシュテーブル
CREATE TABLE shapes_vectortiles_cache (
    tile_key TEXT PRIMARY KEY,             -- "{z}/{x}/{y}" 形式
    shapes_id TEXT NOT NULL,               -- 元のshapes.node_id
    zoom INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    data BLOB NOT NULL,                    -- 圧縮済みMVTデータ
    size INTEGER NOT NULL,                 -- データサイズ (bytes)
    feature_count INTEGER NOT NULL DEFAULT 0,
    bounds TEXT NOT NULL,                  -- タイルの地理的境界 [minX, minY, maxX, maxY]
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    expires_at INTEGER NOT NULL,           -- TTL: 12時間後
    hits INTEGER NOT NULL DEFAULT 0,       -- キャッシュヒット回数
    
    -- 制約
    CONSTRAINT chk_zoom_range CHECK (zoom >= 0 AND zoom <= 22),
    CONSTRAINT chk_tile_coords CHECK (x >= 0 AND y >= 0),
    CONSTRAINT chk_data_not_empty CHECK (length(data) > 0),
    CONSTRAINT chk_size_positive CHECK (size > 0),
    CONSTRAINT chk_bounds_valid CHECK (json_valid(bounds))
);

-- 🟡 バッチ処理タスクテーブル
CREATE TABLE shapes_processing_tasks (
    task_id TEXT PRIMARY KEY,              -- UUID
    type TEXT NOT NULL,                     -- 'download' | 'vectorTile' | 'geometry' | 'transform'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress INTEGER NOT NULL DEFAULT 0,   -- 0-100 percent
    metadata TEXT,                         -- タスク固有のメタデータ (JSON)
    error_message TEXT,                    -- エラー発生時の詳細
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    started_at INTEGER,
    completed_at INTEGER,
    expires_at INTEGER NOT NULL,           -- TTL: 1時間後
    
    -- 制約
    CONSTRAINT chk_task_type CHECK (type IN ('download', 'vectorTile', 'geometry', 'transform')),
    CONSTRAINT chk_task_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT chk_progress_range CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT chk_metadata_valid CHECK (metadata IS NULL OR json_valid(metadata))
);

-- 🔴 空間索引キャッシュテーブル (高度な空間検索用)
CREATE TABLE shapes_spatial_index (
    shapes_id TEXT PRIMARY KEY,            -- _shapes_buggy.node_id への外部キー
    rtree_data TEXT NOT NULL,              -- R-tree索引構造 (JSON)
    quadtree_data TEXT,                    -- QuadTree索引構造 (JSON) - ベクトルタイル用
    index_type TEXT NOT NULL DEFAULT 'rtree', -- 'rtree' | 'quadtree' | 'combined'
    max_features_per_node INTEGER NOT NULL DEFAULT 10,
    max_depth INTEGER NOT NULL DEFAULT 10,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    
    -- 制約
    CONSTRAINT chk_rtree_valid CHECK (json_valid(rtree_data)),
    CONSTRAINT chk_quadtree_valid CHECK (quadtree_data IS NULL OR json_valid(quadtree_data)),
    CONSTRAINT chk_index_type CHECK (index_type IN ('rtree', 'quadtree', 'combined')),
    CONSTRAINT chk_max_features_positive CHECK (max_features_per_node > 0),
    CONSTRAINT chk_max_depth_positive CHECK (max_depth > 0 AND max_depth <= 20)
);

-- 🟢 インデックス定義 (EphemeralDB)
CREATE INDEX idx_workingcopies_working_copy_of ON shapes_workingcopies(working_copy_of);
CREATE INDEX idx_workingcopies_is_dirty ON shapes_workingcopies(is_dirty);
CREATE INDEX idx_workingcopies_updated_at ON shapes_workingcopies(updated_at DESC);

CREATE INDEX idx_vectortiles_shapes_id ON shapes_vectortiles_cache(shapes_id);
CREATE INDEX idx_vectortiles_zoom ON shapes_vectortiles_cache(zoom);
CREATE INDEX idx_vectortiles_expires_at ON shapes_vectortiles_cache(expires_at);
CREATE INDEX idx_vectortiles_hits ON shapes_vectortiles_cache(hits DESC);
CREATE UNIQUE INDEX idx_vectortiles_coords ON shapes_vectortiles_cache(shapes_id, zoom, x, y);

CREATE INDEX idx_tasks_status ON shapes_processing_tasks(status);
CREATE INDEX idx_tasks_type ON shapes_processing_tasks(type);
CREATE INDEX idx_tasks_created_at ON shapes_processing_tasks(created_at DESC);
CREATE INDEX idx_tasks_expires_at ON shapes_processing_tasks(expires_at);

CREATE INDEX idx_spatial_index_type ON shapes_spatial_index(index_type);
CREATE INDEX idx_spatial_index_updated_at ON shapes_spatial_index(updated_at DESC);

-- ============================================================================
-- ビュー定義 (複合クエリの最適化)
-- ============================================================================

-- 🟡 Shapesの統合情報ビュー (メタデータ含む)
CREATE VIEW shapes_with_metadata AS
SELECT 
    s.node_id,
    s.name,
    s.description,
    s.geojson_data,
    s.layer_config,
    s.default_style,
    s.data_source,
    s.processing_options,
    s.created_at,
    s.updated_at,
    s.version,
    m.feature_count,
    m.total_vertices,
    m.data_size,
    m.bounding_box,
    m.geometry_types,
    m.crs,
    m.last_processed
FROM shapes s
LEFT JOIN shapes_metadata m ON s.node_id = m.shapes_id;

-- 🟡 アクティブなWorking Copyビュー
CREATE VIEW active_working_copies AS
SELECT 
    working_copy_id,
    working_copy_of,
    name,
    is_dirty,
    copied_at,
    updated_at,
    (unixepoch() * 1000 - copied_at) as age_ms
FROM shapes_workingcopies
WHERE copied_at > (unixepoch() * 1000 - 86400000); -- 24時間以内

-- 🟡 ベクトルタイルキャッシュ統計ビュー
CREATE VIEW vectortile_cache_stats AS
SELECT 
    shapes_id,
    COUNT(*) as tile_count,
    SUM(size) as total_size,
    AVG(size) as avg_tile_size,
    SUM(hits) as total_hits,
    MIN(zoom) as min_zoom,
    MAX(zoom) as max_zoom,
    MAX(created_at) as last_generated
FROM shapes_vectortiles_cache
WHERE expires_at > (unixepoch() * 1000)  -- 未期限切れのみ
GROUP BY shapes_id;

-- ============================================================================
-- トリガー定義 (データ整合性・自動更新)
-- ============================================================================

-- 🟢 shapes更新時にupdated_atとversionを自動更新
CREATE TRIGGER update_shapes_timestamp
    AFTER UPDATE ON shapes
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at  -- 明示的な更新でない場合のみ
BEGIN
    UPDATE shapes 
    SET updated_at = (unixepoch() * 1000),
        version = version + 1
    WHERE node_id = NEW.node_id;
END;

-- 🟡 shapes削除時に関連データを自動削除
CREATE TRIGGER delete_shapes_cascade
    AFTER DELETE ON shapes
    FOR EACH ROW
BEGIN
    -- メタデータ削除
    DELETE FROM shapes_metadata WHERE shapes_id = OLD.node_id;
    
    -- Working Copy削除
    DELETE FROM shapes_workingcopies WHERE working_copy_of = OLD.node_id;
    
    -- ベクトルタイルキャッシュ削除
    DELETE FROM shapes_vectortiles_cache WHERE shapes_id = OLD.node_id;
    
    -- 空間索引削除
    DELETE FROM shapes_spatial_index WHERE shapes_id = OLD.node_id;
END;

-- 🟡 Working Copy更新時のdirtyフラグ自動設定
CREATE TRIGGER mark_working_copy_dirty
    AFTER UPDATE ON shapes_workingcopies
    FOR EACH ROW
    WHEN (NEW.geojson_data != OLD.geojson_data OR 
          NEW.layer_config != OLD.layer_config OR 
          NEW.default_style != OLD.default_style)
BEGIN
    UPDATE shapes_workingcopies 
    SET is_dirty = TRUE,
        updated_at = (unixepoch() * 1000)
    WHERE working_copy_id = NEW.working_copy_id;
END;

-- 🟡 期限切れデータの自動削除トリガー (定期実行想定)
CREATE TRIGGER cleanup_expired_data
    AFTER INSERT ON shapes_processing_tasks  -- 新しいタスク作成をトリガーに使用
    FOR EACH ROW
BEGIN
    -- 期限切れベクトルタイル削除
    DELETE FROM shapes_vectortiles_cache 
    WHERE expires_at < (unixepoch() * 1000);
    
    -- 期限切れタスク削除
    DELETE FROM shapes_processing_tasks 
    WHERE expires_at < (unixepoch() * 1000) AND status IN ('completed', 'failed', 'cancelled');
    
    -- 古いWorking Copy削除 (24時間経過、かつ未編集)
    DELETE FROM shapes_workingcopies 
    WHERE copied_at < (unixepoch() * 1000 - 86400000) AND is_dirty = FALSE;
END;

-- ============================================================================
-- データベース設定・最適化
-- ============================================================================

-- 🟢 SQLite設定（hierarchidb標準）
PRAGMA foreign_keys = ON;                 -- 外部キー制約有効
PRAGMA journal_mode = WAL;                -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;              -- バランス型同期
PRAGMA cache_size = -64000;               -- 64MB キャッシュ
PRAGMA temp_store = MEMORY;               -- 一時データをメモリ保存
PRAGMA mmap_size = 268435456;             -- 256MB メモリマップ

-- 🟡 統計情報更新（パフォーマンス最適化）
ANALYZE shapes;
ANALYZE shapes_metadata;
ANALYZE shapes_vectortiles_cache;

-- ============================================================================
-- サンプルデータ挿入（開発・テスト用）
-- ============================================================================

-- 🟢 サンプルShapesエンティティ
INSERT OR IGNORE INTO shapes (node_id, name, description, geojson_data, layer_config, default_style) VALUES 
(
    'sample-_shapes_buggy-001',
    'Tokyo Districts',
    'Sample polygon data for Tokyo districts',
    '{"type":"FeatureCollection","features":[{"type":"Feature","id":"tokyo-shibuya","geometry":{"type":"Polygon","coordinates":[[[139.6917,35.6595],[139.7044,35.6595],[139.7044,35.6762],[139.6917,35.6762],[139.6917,35.6595]]]},"properties":{"name":"Shibuya","population":230000}}]}',
    '{"visible":true,"opacity":0.8,"zIndex":10,"minZoom":10,"maxZoom":18,"interactive":true}',
    '{"polygon":{"fillColor":"#3388ff","fillOpacity":0.6,"strokeColor":"#0066cc","strokeWidth":2,"strokeOpacity":0.8},"label":{"field":"name","fontSize":14,"fontFamily":"Arial","fontColor":"#333333","textAlign":"center"}}'
);

-- 🟡 対応するメタデータ
INSERT OR IGNORE INTO shapes_metadata (shapes_id, feature_count, total_vertices, data_size, bounding_box, geometry_types, crs) VALUES 
(
    'sample-_shapes_buggy-001',
    1,
    5,
    256,
    '[139.6917, 35.6595, 139.7044, 35.6762]',
    '["Polygon"]',
    'EPSG:4326'
);

-- ============================================================================
-- パフォーマンス監視クエリ（運用時の監視用）
-- ============================================================================

-- 🟢 テーブルサイズ監視
-- SELECT 
--     name as table_name,
--     COUNT(*) as row_count,
--     SUM(length(geojson_data)) as total_geojson_size
-- FROM _shapes_buggy;

-- 🟡 キャッシュ効率監視  
-- SELECT 
--     shapes_id,
--     tile_count,
--     total_size / 1024 / 1024 as size_mb,
--     total_hits,
--     ROUND(total_hits * 1.0 / tile_count, 2) as avg_hits_per_tile
-- FROM vectortile_cache_stats
-- ORDER BY total_hits DESC;

-- 🟡 処理タスク監視
-- SELECT 
--     type,
--     status,
--     COUNT(*) as task_count,
--     AVG(CASE WHEN completed_at IS NOT NULL THEN completed_at - started_at END) as avg_duration_ms
-- FROM shapes_processing_tasks
-- WHERE created_at > (unixepoch() * 1000 - 86400000)  -- 24時間以内
-- GROUP BY type, status;

-- ============================================================================