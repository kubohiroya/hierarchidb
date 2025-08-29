"use strict";
exports.__esModule = true;
exports.useMultiSelection = void 0;
var react_1 = require("react");
var useMultiSelection = function (_a) {
    var results = _a.results, onSelectionChange = _a.onSelectionChange, onMapFocus = _a.onMapFocus;
    var _b = (0, react_1.useState)(new Set()), selectedResults = _b[0], setSelectedResults = _b[1];
    var _c = (0, react_1.useState)(-1), lastSelectedIndex = _c[0], setLastSelectedIndex = _c[1];
    // 選択された結果アイテムの配列
    var selectedResultItems = (0, react_1.useMemo)(function () {
        return results.filter(function (result) { return selectedResults.has(result.nodeId); });
    }, [results, selectedResults]);
    // 選択状態変更の通知
    var notifySelectionChange = (0, react_1.useCallback)(function (newSelectedResults) {
        if (onSelectionChange) {
            var selectedItems = results.filter(function (result) { return newSelectedResults.has(result.nodeId); });
            onSelectionChange(selectedItems);
        }
    }, [results, onSelectionChange]);
    // 単一選択または複数選択の処理
    var handleResultSelect = (0, react_1.useCallback)(function (result, isMultiSelect) {
        var resultIndex = results.findIndex(function (r) { return r.nodeId === result.nodeId; });
        setSelectedResults(function (prev) {
            var newSelected = new Set(prev);
            var isCurrentlySelected = newSelected.has(result.nodeId);
            if (!isMultiSelect) {
                // 通常のクリック：単一選択
                newSelected.clear();
                newSelected.add(result.nodeId);
                setLastSelectedIndex(resultIndex);
            }
            else {
                // Shift/Cmd+クリック：複数選択
                if (event && event.shiftKey && lastSelectedIndex !== -1) {
                    // Shift+クリック：範囲選択
                    var startIndex = Math.min(lastSelectedIndex, resultIndex);
                    var endIndex = Math.max(lastSelectedIndex, resultIndex);
                    for (var i = startIndex; i <= endIndex; i++) {
                        if (results[i]) {
                            newSelected.add(results[i].nodeId);
                        }
                    }
                }
                else {
                    // Cmd/Ctrl+クリック：トグル選択
                    if (isCurrentlySelected) {
                        newSelected["delete"](result.nodeId);
                    }
                    else {
                        newSelected.add(result.nodeId);
                    }
                    setLastSelectedIndex(resultIndex);
                }
            }
            notifySelectionChange(newSelected);
            return newSelected;
        });
    }, [results, lastSelectedIndex, notifySelectionChange]);
    // 地図フォーカス処理
    var handleMapFocus = (0, react_1.useCallback)(function (result) {
        if (onMapFocus) {
            onMapFocus(result);
        }
    }, [onMapFocus]);
    // 全選択
    var selectAll = (0, react_1.useCallback)(function () {
        var newSelected = new Set(results.map(function (result) { return result.nodeId; }));
        setSelectedResults(newSelected);
        notifySelectionChange(newSelected);
    }, [results, notifySelectionChange]);
    // 選択解除
    var clearSelection = (0, react_1.useCallback)(function () {
        var newSelected = new Set();
        setSelectedResults(newSelected);
        setLastSelectedIndex(-1);
        notifySelectionChange(newSelected);
    }, [notifySelectionChange]);
    // 個別トグル
    var toggleSelection = (0, react_1.useCallback)(function (result) {
        setSelectedResults(function (prev) {
            var newSelected = new Set(prev);
            if (newSelected.has(result.nodeId)) {
                newSelected["delete"](result.nodeId);
            }
            else {
                newSelected.add(result.nodeId);
            }
            notifySelectionChange(newSelected);
            return newSelected;
        });
    }, [notifySelectionChange]);
    return {
        selectedResults: selectedResults,
        selectedResultItems: selectedResultItems,
        handleResultSelect: handleResultSelect,
        handleMapFocus: handleMapFocus,
        selectAll: selectAll,
        clearSelection: clearSelection,
        toggleSelection: toggleSelection
    };
};
exports.useMultiSelection = useMultiSelection;
