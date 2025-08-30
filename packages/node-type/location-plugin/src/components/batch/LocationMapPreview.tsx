/**
 * Location Map Preview Component
 * 地点データのマップ表示とインタラクティブプレビュー
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Slider,
  Grid,
  Tooltip,
  Fab,
  Menu,
  MenuList,
  MenuItem,

  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  TextField
} from '@mui/material';
import {
  LocationOn,
  GroupWork,
  Whatshot,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  Settings,
  Search,
  MyLocation,
  Layers,
  Info
} from '@mui/icons-material';
import type { NodeId, LocationType } from '../../types';

// 地点データの型定義
export interface LocationPoint {
  id: string;
  name: string;
  nameEn?: string;
  type: LocationType;
  countryCode: string;
  coordinates: [number, number]; // [longitude, latitude]
  properties: {
    population?: number;
    elevation?: number;
    capacity?: number;
    [key: string]: any;
  };
}

// 表示モード
export type DisplayMode = 'points' | 'clusters' | 'heatmap';

// マップ統計
export interface MapStatistics {
  totalPoints: number;
  visiblePoints: number;
  clusters: number;
  density: number;
  viewport: {
    bounds: [[number, number], [number, number]]; // [[west, south], [east, north]]
    zoom: number;
    center: [number, number];
  };
  distribution: {
    byType: Record<LocationType, number>;
    byCountry: Record<string, number>;
  };
}

export interface LocationMapPreviewProps {
  nodeId: NodeId;
  locations: LocationPoint[];
  onLocationSelect?: (location: LocationPoint) => void;
}

// サンプルデータ（実際はpropsから受け取る）
const SAMPLE_LOCATIONS: LocationPoint[] = [
  {
    id: '1',
    name: '成田国際空港',
    nameEn: 'Narita International Airport',
    type: 'airport' as LocationType,
    countryCode: 'JPN',
    coordinates: [140.3862, 35.7653],
    properties: { capacity: 30000000 }
  },
  {
    id: '2',
    name: '東京駅',
    nameEn: 'Tokyo Station',
    type: 'railway_station' as LocationType,
    countryCode: 'JPN',
    coordinates: [139.7673, 35.6812],
    properties: { elevation: 6 }
  },
  {
    id: '3',
    name: '横浜港',
    nameEn: 'Port of Yokohama',
    type: 'port' as LocationType,
    countryCode: 'JPN',
    coordinates: [139.6425, 35.4437],
    properties: { capacity: 45000000 }
  }
];

// 地点タイプの表示設定
const TYPE_SETTINGS: Record<LocationType, { 
  color: string; 
  icon: string; 
  name: string;
  defaultVisible: boolean; 
}> = {
  airport: { color: '#2196F3', icon: '✈️', name: '空港', defaultVisible: true },
  railway_station: { color: '#4CAF50', icon: '🚂', name: '駅', defaultVisible: true },
  bus_stop: { color: '#FF5722', icon: '🚌', name: 'バス停', defaultVisible: false },
  port: { color: '#FF9800', icon: '🚢', name: '港', defaultVisible: true },
  hospital: { color: '#F44336', icon: '🏥', name: '病院', defaultVisible: true },
  school: { color: '#795548', icon: '🏫', name: '学校', defaultVisible: false },
  university: { color: '#3F51B5', icon: '🎓', name: '大学', defaultVisible: true },
  tourist_attraction: { color: '#E91E63', icon: '🎯', name: '観光地', defaultVisible: true },
  hotel: { color: '#9C27B0', icon: '🏨', name: 'ホテル', defaultVisible: false },
  restaurant: { color: '#FFC107', icon: '🍽️', name: 'レストラン', defaultVisible: false },
  shopping: { color: '#607D8B', icon: '🛍️', name: 'ショッピング', defaultVisible: false },
  park: { color: '#4CAF50', icon: '🌳', name: '公園', defaultVisible: true },
  library: { color: '#795548', icon: '📚', name: '図書館', defaultVisible: false },
  museum: { color: '#9C27B0', icon: '🏛️', name: '博物館', defaultVisible: true },
  bank: { color: '#2196F3', icon: '🏦', name: '銀行', defaultVisible: false },
  post_office: { color: '#FF9800', icon: '📮', name: '郵便局', defaultVisible: false },
  fire_station: { color: '#F44336', icon: '🚒', name: '消防署', defaultVisible: true },
  police: { color: '#3F51B5', icon: '👮', name: '警察', defaultVisible: true },
  government: { color: '#607D8B', icon: '🏛️', name: '行政', defaultVisible: true },
  religious: { color: '#795548', icon: '⛪', name: '宗教施設', defaultVisible: false }
};

export const LocationMapPreview: React.FC<LocationMapPreviewProps> = ({
  locations = SAMPLE_LOCATIONS
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('points');
  const [visibleTypes, setVisibleTypes] = useState<LocationType[]>(
    Object.keys(TYPE_SETTINGS).filter(type => 
      TYPE_SETTINGS[type as LocationType].defaultVisible
    ) as LocationType[]
  );
  const [zoom, setZoom] = useState(10);
  const [center, setCenter] = useState<[number, number]>([139.7, 35.7]); // Tokyo
  const [selectedLocation, setSelectedLocation] = useState<LocationPoint | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  
  // ヒートマップ設定
  const [heatmapIntensity, setHeatmapIntensity] = useState(1.0);
  const [heatmapRadius, setHeatmapRadius] = useState(20);
  
  // クラスタリング設定
  const [clusterRadius, setClusterRadius] = useState(50);
  const [maxZoom, setMaxZoom] = useState(15);
  
  // フィルタされた地点データ
  const filteredLocations = React.useMemo(() => {
    return locations.filter(location => {
      // タイプフィルタ
      if (!visibleTypes.includes(location.type)) {
        return false;
      }
      
      // 検索クエリフィルタ
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = location.name.toLowerCase().includes(query) ||
                           location.nameEn?.toLowerCase().includes(query);
        const matchesCountry = location.countryCode.toLowerCase().includes(query);
        const matchesType = TYPE_SETTINGS[location.type].name.includes(query);
        
        if (!matchesName && !matchesCountry && !matchesType) {
          return false;
        }
      }
      
      return true;
    });
  }, [locations, visibleTypes, searchQuery]);
  
  // 統計計算
  const statistics: MapStatistics = React.useMemo(() => {
    const byType: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    
    filteredLocations.forEach(location => {
      byType[location.type] = (byType[location.type] || 0) + 1;
      byCountry[location.countryCode] = (byCountry[location.countryCode] || 0) + 1;
    });
    
    return {
      totalPoints: locations.length,
      visiblePoints: filteredLocations.length,
      clusters: displayMode === 'clusters' ? Math.ceil(filteredLocations.length / 10) : 0,
      density: filteredLocations.length / 100, // 簡易計算
      viewport: {
        bounds: [[-180, -90], [180, 90]],
        zoom,
        center
      },
      distribution: {
        byType: byType as Record<LocationType, number>,
        byCountry
      }
    };
  }, [filteredLocations, locations.length, displayMode, zoom, center]);
  
  // 表示モード変更
  const handleDisplayModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: DisplayMode | null
  ) => {
    if (newMode !== null) {
      setDisplayMode(newMode);
    }
  };
  
  // タイプ表示切り替え
  const handleTypeToggle = (type: LocationType) => {
    setVisibleTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  // 地点クリックハンドラー

  
  // ズーム変更
  const handleZoomChange = (newZoom: number) => {
    setZoom(Math.max(1, Math.min(20, newZoom)));
  };
  
  // 現在位置への移動
  const handleMoveToCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      setCenter([position.coords.longitude, position.coords.latitude]);
      setZoom(15);
    });
  };
  
  // 全地点表示
  const handleFitToData = () => {
    if (filteredLocations.length === 0) return;
    
    const lngs = filteredLocations.map(l => l.coordinates[0]);
    const lats = filteredLocations.map(l => l.coordinates[1]);
    
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    
    setCenter([centerLng, centerLat]);
    setZoom(8); // 適切なズームレベル計算は実装で調整
  };
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 地図コントロールバー */}
      <Paper elevation={1} sx={{ p: 2, mb: 1 }}>
        <Grid container spacing={2} alignItems="center">
          {/* 表示モード切り替え */}
          <Grid item xs={12} md={4}>
            <ToggleButtonGroup
              value={displayMode}
              exclusive
              onChange={handleDisplayModeChange}
              size="small"
            >
              <ToggleButton value="points">
                <LocationOn fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>Points</Typography>
              </ToggleButton>
              <ToggleButton value="clusters">
                <GroupWork fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>Clusters</Typography>
              </ToggleButton>
              <ToggleButton value="heatmap">
                <Whatshot fontSize="small" />
                <Typography variant="caption" sx={{ ml: 0.5 }}>Heatmap</Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          
          {/* 検索 */}
          <Grid item xs={12} md={4}>
            <TextField
              size="small"
              fullWidth
              placeholder="地点を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />
              }}
            />
          </Grid>
          
          {/* 統計表示 */}
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                label={`${statistics.visiblePoints.toLocaleString()} / ${statistics.totalPoints.toLocaleString()}`}
                size="small"
                color="primary"
              />
              {displayMode === 'clusters' && statistics.clusters > 0 && (
                <Chip
                  label={`${statistics.clusters} clusters`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Grid>
        </Grid>
        
        {/* タイプフィルター */}
        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          {Object.entries(TYPE_SETTINGS).map(([type, config]) => {
            const count = statistics.distribution.byType[type as LocationType] || 0;
            const isVisible = visibleTypes.includes(type as LocationType);
            
            return (
              <Chip
                key={type}
                label={`${config.icon} ${config.name} (${count})`}
                variant={isVisible ? "filled" : "outlined"}
                color={isVisible ? "primary" : "default"}
                onClick={() => handleTypeToggle(type as LocationType)}
                sx={{ 
                  backgroundColor: isVisible ? config.color : 'transparent',
                  '&:hover': {
                    backgroundColor: isVisible ? config.color : 'action.hover'
                  }
                }}
              />
            );
          })}
        </Box>
      </Paper>
      
      {/* 地図エリア */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: 'grey.100', borderRadius: 1 }}>
        <div 
          ref={mapRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary'
          }}
        >
          {/* 仮の地図表示（実際はMapLibre GLなどを使用） */}
          <Box textAlign="center">
            <Typography variant="h6" gutterBottom>
              地図プレビュー
            </Typography>
            <Typography variant="body2" gutterBottom>
              表示モード: {displayMode}
            </Typography>
            <Typography variant="body2" gutterBottom>
              表示地点数: {statistics.visiblePoints.toLocaleString()}
            </Typography>
            <Typography variant="body2">
              中心座標: {center[1].toFixed(3)}, {center[0].toFixed(3)}
            </Typography>
          </Box>
        </div>
        
        {/* マップコントロール */}
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <Box display="flex" flexDirection="column" gap={1}>
            <Tooltip title="ズームイン">
              <Fab 
                size="small" 
                onClick={() => handleZoomChange(zoom + 1)}
                disabled={zoom >= 20}
              >
                <ZoomIn />
              </Fab>
            </Tooltip>
            
            <Tooltip title="ズームアウト">
              <Fab 
                size="small" 
                onClick={() => handleZoomChange(zoom - 1)}
                disabled={zoom <= 1}
              >
                <ZoomOut />
              </Fab>
            </Tooltip>
            
            <Tooltip title="データ範囲に合わせる">
              <Fab size="small" onClick={handleFitToData}>
                <CenterFocusStrong />
              </Fab>
            </Tooltip>
            
            <Tooltip title="現在位置">
              <Fab size="small" onClick={handleMoveToCurrentLocation}>
                <MyLocation />
              </Fab>
            </Tooltip>
            
            <Tooltip title="設定">
              <Fab 
                size="small" 
                onClick={(e) => setSettingsAnchor(e.currentTarget)}
              >
                <Settings />
              </Fab>
            </Tooltip>
          </Box>
        </Box>
        
        {/* ズームレベル表示 */}
        <Box sx={{ position: 'absolute', bottom: 16, left: 16 }}>
          <Chip
            label={`Zoom: ${zoom}`}
            size="small"
            variant="outlined"
            sx={{ bgcolor: 'background.paper' }}
          />
        </Box>
      </Box>
      
      {/* 設定メニュー */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuList>
          <MenuItem onClick={() => setShowSettings(true)}>
            <Layers sx={{ mr: 1 }} />
            表示設定
          </MenuItem>
          <MenuItem onClick={() => console.log('Export view')}>
            <Info sx={{ mr: 1 }} />
            統計情報
          </MenuItem>
        </MenuList>
      </Menu>
      
      {/* 詳細設定ダイアログ */}
      <Dialog 
        open={showSettings} 
        onClose={() => setShowSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>マップ表示設定</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* ヒートマップ設定 */}
            {displayMode === 'heatmap' && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  ヒートマップ設定
                </Typography>
                <Box mb={2}>
                  <Typography gutterBottom>強度: {heatmapIntensity}</Typography>
                  <Slider
                    value={heatmapIntensity}
                    onChange={(_, value) => setHeatmapIntensity(value as number)}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    marks={[
                      { value: 0.5, label: '0.5' },
                      { value: 1.0, label: '1.0' },
                      { value: 1.5, label: '1.5' }
                    ]}
                  />
                </Box>
                <Box mb={2}>
                  <Typography gutterBottom>半径: {heatmapRadius}px</Typography>
                  <Slider
                    value={heatmapRadius}
                    onChange={(_, value) => setHeatmapRadius(value as number)}
                    min={10}
                    max={50}
                    step={5}
                    marks={[
                      { value: 20, label: '20px' },
                      { value: 30, label: '30px' },
                      { value: 40, label: '40px' }
                    ]}
                  />
                </Box>
              </Box>
            )}
            
            {/* クラスタリング設定 */}
            {displayMode === 'clusters' && (
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  クラスタリング設定
                </Typography>
                <Box mb={2}>
                  <Typography gutterBottom>クラスタ半径: {clusterRadius}px</Typography>
                  <Slider
                    value={clusterRadius}
                    onChange={(_, value) => setClusterRadius(value as number)}
                    min={20}
                    max={100}
                    step={10}
                    marks={[
                      { value: 30, label: '30px' },
                      { value: 50, label: '50px' },
                      { value: 80, label: '80px' }
                    ]}
                  />
                </Box>
                <Box mb={2}>
                  <Typography gutterBottom>最大ズーム: {maxZoom}</Typography>
                  <Slider
                    value={maxZoom}
                    onChange={(_, value) => setMaxZoom(value as number)}
                    min={10}
                    max={20}
                    step={1}
                    marks={[
                      { value: 12, label: '12' },
                      { value: 15, label: '15' },
                      { value: 18, label: '18' }
                    ]}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogContent>
          <Button onClick={() => setShowSettings(false)}>
            閉じる
          </Button>
        </DialogContent>
      </Dialog>
      
      {/* 選択された地点の詳細 */}
      {selectedLocation && (
        <Dialog
          open={!!selectedLocation}
          onClose={() => setSelectedLocation(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {TYPE_SETTINGS[selectedLocation.type].icon} {selectedLocation.name}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  英語名
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.nameEn || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  国コード
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.countryCode}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  緯度
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.coordinates[1].toFixed(6)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  経度
                </Typography>
                <Typography variant="body1">
                  {selectedLocation.coordinates[0].toFixed(6)}
                </Typography>
              </Grid>
              {Object.entries(selectedLocation.properties).map(([key, value]) => (
                <Grid item xs={6} key={key}>
                  <Typography variant="body2" color="text.secondary">
                    {key}
                  </Typography>
                  <Typography variant="body1">
                    {typeof value === 'number' ? value.toLocaleString() : String(value)}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogContent>
            <Button onClick={() => setSelectedLocation(null)}>
              閉じる
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};