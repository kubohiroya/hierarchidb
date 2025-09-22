"use strict";
/**
 * @file BaseMapPreview.tsx
 * @description BaseMap preview component for dialog and panel views
 * Shows a live preview of the configured basemap settings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMapPreview = void 0;
var react_1 = require("react");
var material_1 = require("@mui/material");
var icons_material_1 = require("@mui/icons-material");
var ui_map_1 = require("@hierarchidb/ui-map");
var builtInStyles_1 = require("../constants/builtInStyles");
/**
 * Icon mapping for map styles
 */
var STYLE_ICONS = {
    streets: <icons_material_1.Map />,
    satellite: <icons_material_1.Satellite />,
    terrain: <icons_material_1.Terrain />,
    dark: <icons_material_1.DarkMode />,
    light: <icons_material_1.LightMode />,
    custom: <icons_material_1.Tune />
};
/**
 * BaseMap Preview Component
 * Provides a preview of the basemap configuration
 */
var BaseMapPreview = function (_a) {
    var mapStyle = _a.mapStyle, viewport = _a.viewport, zxy = _a.zxy, _b = _a.displayOptions, displayOptions = _b === void 0 ? {} : _b, _c = _a.width, width = _c === void 0 ? '100%' : _c, _d = _a.height, height = _d === void 0 ? 300 : _d, _e = _a.showMetadata, showMetadata = _e === void 0 ? true : _e, _f = _a.interactive, interactive = _f === void 0 ? false : _f, _g = _a.title, title = _g === void 0 ? 'BaseMap Preview' : _g;
    // Convert to MapLibre view state
    var initialViewState = (0, react_1.useMemo)(function () { return ({
        longitude: viewport.center[0],
        latitude: viewport.center[1],
        zoom: viewport.zoom,
        bearing: viewport.bearing || 0,
        pitch: viewport.pitch || 0
    }); }, [viewport]);
    // Generate zxy string from viewport if not provided
    var zxyString = (0, react_1.useMemo)(function () {
        if (zxy)
            return zxy;
        return "".concat(viewport.zoom, ",").concat(viewport.center[0], ",").concat(viewport.center[1]);
    }, [zxy, viewport]);
    // Handle map click to open preview
    var handleMapClick = function () {
        if (!interactive) {
            var baseUrl = window.location.origin;
            var basePath = import.meta.env.VITE_APP_PREFIX ? "/".concat(import.meta.env.VITE_APP_PREFIX, "/") : '/';
            var mapUrl = "".concat(baseUrl).concat(basePath, "map?zxy=").concat(zxyString);
            window.open(mapUrl, '_blank');
        }
    };
    // Get map style URL
    var mapStyleUrl = (0, react_1.useMemo)(function () {
        if (mapStyle.style === 'custom') {
            if (mapStyle.customStyleUrl) {
                return mapStyle.customStyleUrl;
            }
            if (mapStyle.customStyleConfig) {
                return mapStyle.customStyleConfig;
            }
        }
        return (0, builtInStyles_1.getBuiltInStyleUrl)(mapStyle.style);
    }, [mapStyle]);
    // Get attribution
    var attribution = (0, react_1.useMemo)(function () {
        if (displayOptions.attribution) {
            return displayOptions.attribution;
        }
        if (mapStyle.style !== 'custom') {
            return (0, builtInStyles_1.getStyleAttribution)(mapStyle.style);
        }
        return '© Map contributors';
    }, [mapStyle, displayOptions.attribution]);
    return (<material_1.Paper elevation={1} sx={{
            width: width,
            overflow: 'hidden',
            borderRadius: 2,
            position: 'relative'
        }}>
      {/* Header */}
      {showMetadata && (<material_1.Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <material_1.Stack direction="row" alignItems="center" spacing={1}>
            {STYLE_ICONS[mapStyle.style]}
            <material_1.Typography variant="subtitle1" fontWeight="medium">
              {title}
            </material_1.Typography>
            <material_1.Chip label={mapStyle.style} size="small" variant="outlined" color="primary"/>
          </material_1.Stack>
        </material_1.Box>)}

      {/* Map Preview */}
      <material_1.Box sx={{
            position: 'relative',
            height: height,
            cursor: !interactive ? 'pointer' : 'grab'
        }} onClick={handleMapClick} title={!interactive ? "Click to open map at ".concat(zxyString) : undefined}>
        <ui_map_1.MapLibreMap initialViewState={initialViewState} mapStyle={mapStyleUrl} width="100%" height="100%" mapOptions={{
            interactive: interactive,
            scrollZoom: interactive,
            dragPan: interactive,
            dragRotate: interactive,
            doubleClickZoom: interactive,
            touchZoomRotate: interactive
        }} onLoad={function (map) {
            var _a;
            // Apply display options
            if (!displayOptions.showLabels) {
                // Hide all label layers
                var layers = map.getStyle().layers;
                layers.forEach(function (layer) {
                    if (layer.type === 'symbol' && layer.id.includes('label')) {
                        map.setLayoutProperty(layer.id, 'visibility', 'none');
                    }
                });
            }
            // Add 3D buildings if requested and available
            if (displayOptions.show3dBuildings) {
                // Check if the style supports 3D buildings
                if (!map.getLayer('building-3d')) {
                    // Add a simple 3D building layer if not present
                    var layers = map.getStyle().layers;
                    var labelLayerId = (_a = layers.find(function (layer) { var _a; return layer.type === 'symbol' && ((_a = layer.layout) === null || _a === void 0 ? void 0 : _a['text-field']); })) === null || _a === void 0 ? void 0 : _a.id;
                    if (map.getSource('openmaptiles') || map.getSource('composite')) {
                        map.addLayer({
                            id: 'building-3d',
                            source: map.getSource('openmaptiles') ? 'openmaptiles' : 'composite',
                            'source-layer': 'building',
                            type: 'fill-extrusion',
                            minzoom: 15,
                            paint: {
                                'fill-extrusion-color': '#aaa',
                                'fill-extrusion-height': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    15,
                                    0,
                                    15.05,
                                    ['get', 'height']
                                ],
                                'fill-extrusion-base': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    15,
                                    0,
                                    15.05,
                                    ['get', 'min_height']
                                ],
                                'fill-extrusion-opacity': 0.6
                            }
                        }, labelLayerId);
                    }
                }
            }
        }}/>

        {/* Overlay Information */}
        {showMetadata && (<>
            {/* Coordinates */}
            <material_1.Box sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                boxShadow: 1
            }}>
              <material_1.Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {viewport.center[0].toFixed(4)}, {viewport.center[1].toFixed(4)} | z{viewport.zoom.toFixed(1)}
              </material_1.Typography>
            </material_1.Box>

            {/* Display Options */}
            {(displayOptions.show3dBuildings ||
                displayOptions.showTerrain ||
                displayOptions.showTraffic ||
                displayOptions.showTransit) && (<material_1.Box sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    boxShadow: 1
                }}>
                <material_1.Stack direction="row" spacing={0.5}>
                  {displayOptions.show3dBuildings && (<material_1.Chip label="3D" size="small" variant="filled" color="primary"/>)}
                  {displayOptions.showTerrain && (<material_1.Chip label="Terrain" size="small" variant="filled" color="primary"/>)}
                  {displayOptions.showTraffic && (<material_1.Chip label="Traffic" size="small" variant="filled" color="primary"/>)}
                  {displayOptions.showTransit && (<material_1.Chip label="Transit" size="small" variant="filled" color="primary"/>)}
                </material_1.Stack>
              </material_1.Box>)}

            {/* Tags */}
            {displayOptions.tags && displayOptions.tags.length > 0 && (<material_1.Box sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    maxWidth: '60%'
                }}>
                <material_1.Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {displayOptions.tags.slice(0, 3).map(function (tag, index) { return (<material_1.Chip key={index} label={tag} size="small" sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.7rem'
                    }}/>); })}
                  {displayOptions.tags.length > 3 && (<material_1.Chip label={"+".concat(displayOptions.tags.length - 3)} size="small" sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.7rem'
                    }}/>)}
                </material_1.Stack>
              </material_1.Box>)}

            {/* Attribution */}
            <material_1.Box sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                px: 1,
                py: 0.25,
                fontSize: '10px',
                maxWidth: '40%',
                textAlign: 'right'
            }}>
              <material_1.Typography variant="caption" sx={{ fontSize: '10px' }}>
                {attribution}
              </material_1.Typography>
            </material_1.Box>
          </>)}

      </material_1.Box>
    </material_1.Paper>);
};
exports.BaseMapPreview = BaseMapPreview;
exports.default = exports.BaseMapPreview;
