"use strict";
/**
 * @file dialogUrlParams.ts
 * @description ダイアログ用URLパラメータ解析ユーティリティ
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDialogUrlParams = exports.getDialogUrlParams = exports.dialogParamsToUrlSearchParams = exports.parseDialogUrlParams = void 0;
/**
 * ZXY形式のパラメータをパース
 * @param zxyString - "zoom,lng,lat" 形式の文字列
 * @returns パースされた地図パラメータ
 */
function parseZxyParam(zxyString) {
    if (!zxyString)
        return undefined;
    var parts = zxyString.split(',');
    if (parts.length !== 3)
        return undefined;
    var zoom = parseFloat(parts[0]);
    var lng = parseFloat(parts[1]);
    var lat = parseFloat(parts[2]);
    if (isNaN(zoom) || isNaN(lng) || isNaN(lat))
        return undefined;
    return { zoom: zoom, lng: lng, lat: lat };
}
/**
 * URLSearchParamsからダイアログパラメータを解析
 * @param searchParams - URLSearchParamsオブジェクト
 * @returns 解析されたダイアログパラメータ
 */
function parseDialogUrlParams(searchParams) {
    var result = {
        customParams: {},
    };
    // 各パラメータを処理
    for (var _i = 0, _a = searchParams.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        switch (key) {
            case 'step': {
                var stepNum = parseInt(value, 10);
                if (!isNaN(stepNum) && stepNum > 0) {
                    result.step = stepNum;
                }
                break;
            }
            case 'dialog': {
                if (value === 'full' || value === 'normal') {
                    result.dialogMode = value;
                }
                break;
            }
            case 'zxy': {
                var mapParams = parseZxyParam(value);
                if (mapParams) {
                    result.mapParams = mapParams;
                }
                break;
            }
            default:
                // その他のパラメータは customParams に格納
                result.customParams[key] = value;
                break;
        }
    }
    return result;
}
exports.parseDialogUrlParams = parseDialogUrlParams;
/**
 * ダイアログパラメータをURLSearchParamsに変換
 * @param params - ダイアログパラメータ
 * @returns URLSearchParamsオブジェクト
 */
function dialogParamsToUrlSearchParams(params) {
    var searchParams = new URLSearchParams();
    if (params.step !== undefined) {
        searchParams.set('step', params.step.toString());
    }
    if (params.dialogMode) {
        searchParams.set('dialog', params.dialogMode);
    }
    if (params.mapParams) {
        var _a = params.mapParams, zoom = _a.zoom, lng = _a.lng, lat = _a.lat;
        searchParams.set('zxy', "".concat(zoom, ",").concat(lng, ",").concat(lat));
    }
    // カスタムパラメータを追加
    for (var _i = 0, _b = Object.entries(params.customParams); _i < _b.length; _i++) {
        var _c = _b[_i], key = _c[0], value = _c[1];
        searchParams.set(key, value);
    }
    return searchParams;
}
exports.dialogParamsToUrlSearchParams = dialogParamsToUrlSearchParams;
/**
 * 現在のURLからダイアログパラメータを取得
 * @returns 解析されたダイアログパラメータ
 */
function getDialogUrlParams() {
    if (typeof window === 'undefined') {
        return { customParams: {} };
    }
    var searchParams = new URLSearchParams(window.location.search);
    return parseDialogUrlParams(searchParams);
}
exports.getDialogUrlParams = getDialogUrlParams;
/**
 * ダイアログパラメータでURLを更新（履歴を変更しない）
 * @param params - 更新するパラメータ
 */
function updateDialogUrlParams(params) {
    if (typeof window === 'undefined')
        return;
    var currentParams = getDialogUrlParams();
    var updatedParams = __assign(__assign(__assign({}, currentParams), params), { customParams: __assign(__assign({}, currentParams.customParams), (params.customParams || {})) });
    var searchParams = dialogParamsToUrlSearchParams(updatedParams);
    var newUrl = "".concat(window.location.pathname, "?").concat(searchParams.toString());
    window.history.replaceState(null, '', newUrl);
}
exports.updateDialogUrlParams = updateDialogUrlParams;
