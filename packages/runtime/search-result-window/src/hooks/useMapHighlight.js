"use strict";
exports.__esModule = true;
exports.useMapHighlight = void 0;
var react_1 = require("react");
var MapHighlightService_1 = require("~/services/MapHighlightService");
var useMapHighlight = function (_a) {
    var mapInstance = _a.mapInstance, initialStyles = _a.initialStyles, onStateChange = _a.onStateChange;
    var serviceRef = (0, react_1.useRef)();
    var _b = (0, react_1.useState)({
        searchMatched: new Set(),
        selected: new Set()
    }), highlightState = _b[0], setHighlightState = _b[1];
    // サービスの初期化
    if (!serviceRef.current) {
        serviceRef.current = new MapHighlightService_1.MapHighlightService(initialStyles, mapInstance);
        serviceRef.current.setOnStateChange(function (state) {
            setHighlightState(state);
            if (onStateChange) {
                onStateChange(state);
            }
        });
    }
    // マップインスタンスが変更された場合の処理
    (0, react_1.useEffect)(function () {
        if (mapInstance && serviceRef.current) {
            serviceRef.current.setMapInstance(mapInstance);
        }
    }, [mapInstance]);
    // 検索マッチした要素を設定
    var setSearchMatched = (0, react_1.useCallback)(function (nodeIds) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.setSearchMatched(nodeIds);
    }, []);
    // 選択された要素を設定
    var setSelected = (0, react_1.useCallback)(function (nodeIds) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.setSelected(nodeIds);
    }, []);
    // 検索マッチに追加
    var addSearchMatched = (0, react_1.useCallback)(function (nodeId) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.addSearchMatched(nodeId);
    }, []);
    // 選択に追加
    var addSelected = (0, react_1.useCallback)(function (nodeId) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.addSelected(nodeId);
    }, []);
    // 検索マッチから削除
    var removeSearchMatched = (0, react_1.useCallback)(function (nodeId) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.removeSearchMatched(nodeId);
    }, []);
    // 選択から削除
    var removeSelected = (0, react_1.useCallback)(function (nodeId) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.removeSelected(nodeId);
    }, []);
    // 全てクリア
    var clearAll = (0, react_1.useCallback)(function () {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.clearAll();
    }, []);
    // 検索マッチのみクリア
    var clearSearchMatched = (0, react_1.useCallback)(function () {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.clearSearchMatched();
    }, []);
    // 選択のみクリア
    var clearSelected = (0, react_1.useCallback)(function () {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.clearSelected();
    }, []);
    // スタイル更新
    var updateStyles = (0, react_1.useCallback)(function (styles) {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.updateStyles(styles);
    }, []);
    return {
        highlightState: highlightState,
        setSearchMatched: setSearchMatched,
        setSelected: setSelected,
        addSearchMatched: addSearchMatched,
        addSelected: addSelected,
        removeSearchMatched: removeSearchMatched,
        removeSelected: removeSelected,
        clearAll: clearAll,
        clearSearchMatched: clearSearchMatched,
        clearSelected: clearSelected,
        updateStyles: updateStyles,
        service: serviceRef.current
    };
};
exports.useMapHighlight = useMapHighlight;
