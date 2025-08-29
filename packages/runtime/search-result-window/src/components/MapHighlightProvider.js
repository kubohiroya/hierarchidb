"use strict";
exports.__esModule = true;
exports.useMapHighlightContext = exports.MapHighlightProvider = void 0;
var react_1 = require("react");
var useMapHighlight_1 = require("~/hooks/useMapHighlight");
var MapHighlightContext = (0, react_1.createContext)(null);
/**
 * 地図ハイライト機能を提供するコンテキストプロバイダー
 */
var MapHighlightProvider = function (_a) {
    var children = _a.children, mapInstance = _a.mapInstance, initialStyles = _a.initialStyles, onStateChange = _a.onStateChange;
    var mapHighlight = (0, useMapHighlight_1.useMapHighlight)({
        mapInstance: mapInstance,
        initialStyles: initialStyles,
        onStateChange: onStateChange
    });
    return (<MapHighlightContext.Provider value={mapHighlight}>
      {children}
    </MapHighlightContext.Provider>);
};
exports.MapHighlightProvider = MapHighlightProvider;
/**
 * 地図ハイライト機能を使用するフック
 */
var useMapHighlightContext = function () {
    var context = (0, react_1.useContext)(MapHighlightContext);
    if (!context) {
        throw new Error('useMapHighlightContext must be used within MapHighlightProvider');
    }
    return context;
};
exports.useMapHighlightContext = useMapHighlightContext;
