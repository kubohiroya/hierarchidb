"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.MapHighlightService = void 0;
/**
 * 地図上の要素の強調表示を管理するサービス
 */
var MapHighlightService = /** @class */ (function () {
    function MapHighlightService(customStyles, mapInstance // MapLibre GL JSのマップインスタンス
    ) {
        this.customStyles = customStyles;
        this.mapInstance = mapInstance;
        this.searchMatchedNodes = new Set();
        this.selectedNodes = new Set();
        this.defaultStyles = {
            searchMatch: {
                fillColor: '#FFE082',
                fillOpacity: 0.6
            },
            selection: {
                strokeColor: '#1976D2',
                strokeWidth: 3,
                strokeOpacity: 0.9
            }
        };
        if (customStyles) {
            this.defaultStyles = __assign(__assign({}, this.defaultStyles), customStyles);
        }
    }
    /**
     * 状態変更コールバックを設定
     */
    MapHighlightService.prototype.setOnStateChange = function (callback) {
        this.onStateChangeCallback = callback;
    };
    /**
     * 検索マッチした要素を設定
     */
    MapHighlightService.prototype.setSearchMatched = function (nodeIds) {
        var _this = this;
        this.searchMatchedNodes.clear();
        nodeIds.forEach(function (id) { return _this.searchMatchedNodes.add(id); });
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 選択された要素を設定
     */
    MapHighlightService.prototype.setSelected = function (nodeIds) {
        var _this = this;
        this.selectedNodes.clear();
        nodeIds.forEach(function (id) { return _this.selectedNodes.add(id); });
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 要素を検索マッチに追加
     */
    MapHighlightService.prototype.addSearchMatched = function (nodeId) {
        this.searchMatchedNodes.add(nodeId);
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 要素を選択に追加
     */
    MapHighlightService.prototype.addSelected = function (nodeId) {
        this.selectedNodes.add(nodeId);
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 要素を検索マッチから削除
     */
    MapHighlightService.prototype.removeSearchMatched = function (nodeId) {
        this.searchMatchedNodes["delete"](nodeId);
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 要素を選択から削除
     */
    MapHighlightService.prototype.removeSelected = function (nodeId) {
        this.selectedNodes["delete"](nodeId);
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 全ての強調表示をクリア
     */
    MapHighlightService.prototype.clearAll = function () {
        this.searchMatchedNodes.clear();
        this.selectedNodes.clear();
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 検索マッチのみクリア
     */
    MapHighlightService.prototype.clearSearchMatched = function () {
        this.searchMatchedNodes.clear();
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 選択のみクリア
     */
    MapHighlightService.prototype.clearSelected = function () {
        this.selectedNodes.clear();
        this.notifyStateChange();
        this.updateMapHighlight();
    };
    /**
     * 現在の状態を取得
     */
    MapHighlightService.prototype.getState = function () {
        return {
            searchMatched: new Set(this.searchMatchedNodes),
            selected: new Set(this.selectedNodes)
        };
    };
    /**
     * スタイル設定を取得
     */
    MapHighlightService.prototype.getStyles = function () {
        return this.defaultStyles;
    };
    /**
     * スタイル設定を更新
     */
    MapHighlightService.prototype.updateStyles = function (styles) {
        this.defaultStyles = __assign(__assign({}, this.defaultStyles), styles);
        this.updateMapHighlight();
    };
    /**
     * MapLibre GL JSインスタンスを設定
     */
    MapHighlightService.prototype.setMapInstance = function (mapInstance) {
        this.mapInstance = mapInstance;
        this.setupMapLayers();
        this.updateMapHighlight();
    };
    /**
     * 状態変更を通知
     */
    MapHighlightService.prototype.notifyStateChange = function () {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.getState());
        }
    };
    /**
     * 地図上にハイライト用のレイヤーを設定
     */
    MapHighlightService.prototype.setupMapLayers = function () {
        if (!this.mapInstance)
            return;
        // 検索マッチ用レイヤー（塗りつぶし）
        if (!this.mapInstance.getLayer('search-highlight-fill')) {
            this.mapInstance.addLayer({
                id: 'search-highlight-fill',
                type: 'fill',
                source: 'search-highlight-source',
                paint: {
                    'fill-color': this.defaultStyles.searchMatch.fillColor,
                    'fill-opacity': this.defaultStyles.searchMatch.fillOpacity
                },
                filter: ['in', ['get', 'nodeId'], ['literal', []]]
            });
        }
        // 選択用レイヤー（線）
        if (!this.mapInstance.getLayer('selection-highlight-line')) {
            this.mapInstance.addLayer({
                id: 'selection-highlight-line',
                type: 'line',
                source: 'selection-highlight-source',
                paint: {
                    'line-color': this.defaultStyles.selection.strokeColor,
                    'line-width': this.defaultStyles.selection.strokeWidth,
                    'line-opacity': this.defaultStyles.selection.strokeOpacity
                },
                filter: ['in', ['get', 'nodeId'], ['literal', []]]
            });
        }
    };
    /**
     * 地図上のハイライトを更新
     */
    MapHighlightService.prototype.updateMapHighlight = function () {
        if (!this.mapInstance)
            return;
        try {
            // 検索マッチハイライトの更新
            var searchMatchFilter = [
                'in',
                ['get', 'nodeId'],
                ['literal', Array.from(this.searchMatchedNodes)]
            ];
            if (this.mapInstance.getLayer('search-highlight-fill')) {
                this.mapInstance.setFilter('search-highlight-fill', searchMatchFilter);
            }
            // 選択ハイライトの更新
            var selectionFilter = [
                'in',
                ['get', 'nodeId'],
                ['literal', Array.from(this.selectedNodes)]
            ];
            if (this.mapInstance.getLayer('selection-highlight-line')) {
                this.mapInstance.setFilter('selection-highlight-line', selectionFilter);
            }
        }
        catch (error) {
            console.warn('Failed to update map highlight:', error);
        }
    };
    return MapHighlightService;
}());
exports.MapHighlightService = MapHighlightService;
