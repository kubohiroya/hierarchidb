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
exports.SearchResultTable = void 0;
var react_1 = require("react");
var material_1 = require("@mui/material");
var styles_1 = require("@mui/material/styles");
var StyledTableContainer = (0, styles_1.styled)(material_1.TableContainer)(function (_a) {
    var theme = _a.theme;
    return ({
        maxHeight: 400,
        '& .MuiTableCell-root': {
            padding: theme.spacing(0.5, 1),
            fontSize: '0.75rem',
            borderBottom: "1px solid ".concat(theme.palette.divider)
        },
        '& .MuiTableCell-head': {
            backgroundColor: theme.palette.grey[50],
            fontWeight: 600,
            position: 'sticky',
            top: 0,
            zIndex: 1
        }
    });
});
var StyledTableRow = (0, styles_1.styled)(material_1.TableRow)(function (_a) {
    var theme = _a.theme, selected = _a.selected;
    return (__assign({ cursor: 'pointer', '&:hover': {
            backgroundColor: theme.palette.action.hover
        } }, (selected && {
        backgroundColor: theme.palette.primary.light + '20',
        '&:hover': {
            backgroundColor: theme.palette.primary.light + '30'
        }
    })));
});
var CompactCell = (0, styles_1.styled)(material_1.TableCell)(function (_a) {
    var theme = _a.theme;
    return ({
        maxWidth: 150,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    });
});
var RowDataCell = (0, styles_1.styled)(material_1.TableCell)(function (_a) {
    var theme = _a.theme;
    return ({
        maxWidth: 200,
        '& .row-data': {
            display: 'flex',
            gap: theme.spacing(0.5),
            flexWrap: 'wrap',
            alignItems: 'center'
        }
    });
});
var SearchResultTable = function (_a) {
    var results = _a.results, selectedResults = _a.selectedResults, onResultSelect = _a.onResultSelect, onMapFocus = _a.onMapFocus;
    var handleRowClick = (0, react_1.useCallback)(function (result, event) {
        var isMultiSelect = event.shiftKey || event.metaKey || event.ctrlKey;
        onResultSelect(result, isMultiSelect);
    }, [onResultSelect]);
    var handleRowDoubleClick = (0, react_1.useCallback)(function (result) {
        onMapFocus(result);
    }, [onMapFocus]);
    var renderRowData = (0, react_1.useCallback)(function (result) {
        if (!result.rowData || !result.displayColumns) {
            return <material_1.Typography variant="caption">—</material_1.Typography>;
        }
        return (<material_1.Box className="row-data">
        {result.displayColumns.slice(0, 3).map(function (column) {
                var _a;
                var value = (_a = result.rowData) === null || _a === void 0 ? void 0 : _a[column];
                if (value === undefined || value === null || value === '') {
                    return null;
                }
                var displayValue = typeof value === 'object'
                    ? JSON.stringify(value).slice(0, 20) + '...'
                    : String(value).slice(0, 15);
                return (<material_1.Chip key={column} label={"".concat(column, ":").concat(displayValue)} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }}/>);
            })}
      </material_1.Box>);
    }, []);
    var allSelected = (0, react_1.useMemo)(function () {
        return results.length > 0 && results.every(function (result) { return selectedResults.has(result.nodeId); });
    }, [results, selectedResults]);
    var someSelected = (0, react_1.useMemo)(function () {
        return results.some(function (result) { return selectedResults.has(result.nodeId); });
    }, [results, selectedResults]);
    var handleSelectAll = (0, react_1.useCallback)(function (event) {
        if (event.target.checked) {
            results.forEach(function (result) { return onResultSelect(result, true); });
        }
        else {
            // 全選択解除は個別に処理（実装は親コンポーネント側で）
            results.forEach(function (result) {
                if (selectedResults.has(result.nodeId)) {
                    onResultSelect(result, false);
                }
            });
        }
    }, [results, selectedResults, onResultSelect]);
    if (results.length === 0) {
        return (<material_1.Box sx={{ p: 3, textAlign: 'center' }}>
        <material_1.Typography variant="body2" color="text.secondary">
          検索結果がありません
        </material_1.Typography>
      </material_1.Box>);
    }
    return (<StyledTableContainer component={material_1.Paper} elevation={0}>
      <material_1.Table stickyHeader size="small">
        <material_1.TableHead>
          <material_1.TableRow>
            <material_1.TableCell padding="checkbox">
              <material_1.Checkbox indeterminate={someSelected && !allSelected} checked={allSelected} onChange={handleSelectAll} size="small"/>
            </material_1.TableCell>
            <CompactCell>StyleMap</CompactCell>
            <material_1.TableCell align="center" sx={{ width: 60 }}>行</material_1.TableCell>
            <RowDataCell>データ</RowDataCell>
            <material_1.TableCell align="center" sx={{ width: 50 }}>信頼度</material_1.TableCell>
          </material_1.TableRow>
        </material_1.TableHead>
        <material_1.TableBody>
          {results.map(function (result) {
            var isSelected = selectedResults.has(result.nodeId);
            return (<StyledTableRow key={"".concat(result.nodeId, "-").concat(result.rowIndex || 0)} selected={isSelected} onClick={function (event) { return handleRowClick(result, event); }} onDoubleClick={function () { return handleRowDoubleClick(result); }}>
                <material_1.TableCell padding="checkbox">
                  <material_1.Checkbox checked={isSelected} size="small" onClick={function (event) { return event.stopPropagation(); }}/>
                </material_1.TableCell>
                
                <CompactCell>
                  <material_1.Typography variant="body2" title={result.styleMapNodeName || result.nodeName}>
                    {result.styleMapNodeName || result.nodeName}
                  </material_1.Typography>
                </CompactCell>
                
                <material_1.TableCell align="center">
                  <material_1.Typography variant="caption" color="primary">
                    {typeof result.rowIndex === 'number' ? result.rowIndex + 1 : '—'}
                  </material_1.Typography>
                </material_1.TableCell>
                
                <RowDataCell>
                  {renderRowData(result)}
                </RowDataCell>
                
                <material_1.TableCell align="center">
                  <material_1.Typography variant="caption" color={result.confidence > 0.8 ? 'success.main' :
                    result.confidence > 0.6 ? 'warning.main' : 'error.main'}>
                    {Math.round(result.confidence * 100)}%
                  </material_1.Typography>
                </material_1.TableCell>
              </StyledTableRow>);
        })}
        </material_1.TableBody>
      </material_1.Table>
    </StyledTableContainer>);
};
exports.SearchResultTable = SearchResultTable;
