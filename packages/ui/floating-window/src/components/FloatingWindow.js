"use strict";
/**
 * @file FloatingWindow.tsx
 * @description Main floating window component with drag and resize functionality
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
exports.__esModule = true;
exports.FloatingWindow = void 0;
var react_1 = require("react");
var material_1 = require("@mui/material");
var icons_material_1 = require("@mui/icons-material");
var StyledWindow = (0, material_1.styled)(material_1.Paper)(function (_a) {
    var theme = _a.theme;
    return ({
        position: 'fixed',
        borderRadius: theme.spacing(1),
        boxShadow: theme.shadows[8],
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        '&.floating-window': {
            transition: 'box-shadow 0.3s ease'
        },
        '&:hover': {
            boxShadow: theme.shadows[12]
        }
    });
});
var TitleBar = (0, material_1.styled)(material_1.Box)(function (_a) {
    var theme = _a.theme;
    return ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing(1, 2),
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        cursor: 'move',
        minHeight: 40
    });
});
var WindowContent = (0, material_1.styled)(material_1.Box)(function (_a) {
    var theme = _a.theme;
    return ({
        flex: 1,
        padding: theme.spacing(2),
        overflowY: 'auto',
        backgroundColor: theme.palette.background.paper
    });
});
var ResizeHandle = (0, material_1.styled)(material_1.Box)({
    position: 'absolute',
    '&.resize-n': {
        top: 0,
        left: 10,
        right: 10,
        height: 5,
        cursor: 'ns-resize'
    },
    '&.resize-ne': {
        top: 0,
        right: 0,
        width: 10,
        height: 10,
        cursor: 'nesw-resize'
    },
    '&.resize-e': {
        top: 10,
        right: 0,
        bottom: 10,
        width: 5,
        cursor: 'ew-resize'
    },
    '&.resize-se': {
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        cursor: 'nwse-resize'
    },
    '&.resize-s': {
        bottom: 0,
        left: 10,
        right: 10,
        height: 5,
        cursor: 'ns-resize'
    },
    '&.resize-sw': {
        bottom: 0,
        left: 0,
        width: 10,
        height: 10,
        cursor: 'nesw-resize'
    },
    '&.resize-w': {
        top: 10,
        left: 0,
        bottom: 10,
        width: 5,
        cursor: 'ew-resize'
    },
    '&.resize-nw': {
        top: 0,
        left: 0,
        width: 10,
        height: 10,
        cursor: 'nwse-resize'
    }
});
var FloatingWindow = function (_a) {
    var title = _a.title, children = _a.children, initialState = _a.initialState, onStateChange = _a.onStateChange, onClose = _a.onClose, _b = _a.minWidth, minWidth = _b === void 0 ? 200 : _b, _c = _a.minHeight, minHeight = _c === void 0 ? 100 : _c, maxWidth = _a.maxWidth, maxHeight = _a.maxHeight, _d = _a.resizable, resizable = _d === void 0 ? true : _d, _e = _a.draggable, draggable = _e === void 0 ? true : _e, className = _a.className, style = _a.style;
    var theme = (0, material_1.useTheme)();
    var windowRef = (0, react_1.useRef)(null);
    var isDragging = (0, react_1.useRef)(false);
    var isResizing = (0, react_1.useRef)(false);
    var dragStart = (0, react_1.useRef)({ x: 0, y: 0 });
    var resizeStart = (0, react_1.useRef)({ width: 0, height: 0, x: 0, y: 0 });
    var resizeDirection = (0, react_1.useRef)('');
    var _f = (0, react_1.useState)({
        position: (initialState === null || initialState === void 0 ? void 0 : initialState.position) || { x: 100, y: 100 },
        size: (initialState === null || initialState === void 0 ? void 0 : initialState.size) || { width: 400, height: 300 },
        isMinimized: (initialState === null || initialState === void 0 ? void 0 : initialState.isMinimized) || false,
        isVisible: (initialState === null || initialState === void 0 ? void 0 : initialState.isVisible) !== false,
        zIndex: (initialState === null || initialState === void 0 ? void 0 : initialState.zIndex) || 1000
    }), state = _f[0], setState = _f[1];
    // Calculate constraints
    var effectiveMaxWidth = maxWidth || window.innerWidth - 50;
    var effectiveMaxHeight = maxHeight || window.innerHeight - 50;
    // Update external state
    (0, react_1.useEffect)(function () {
        onStateChange === null || onStateChange === void 0 ? void 0 : onStateChange(state);
    }, [state, onStateChange]);
    // Handle dragging
    var handleMouseDown = (0, react_1.useCallback)(function (e) {
        if (!draggable || e.button !== 0)
            return;
        // Check if clicking on title bar
        var target = e.target;
        if (!target.closest('.title-bar'))
            return;
        isDragging.current = true;
        dragStart.current = {
            x: e.clientX - state.position.x,
            y: e.clientY - state.position.y
        };
        e.preventDefault();
    }, [draggable, state.position]);
    // Handle resizing
    var handleResizeMouseDown = (0, react_1.useCallback)(function (direction) { return function (e) {
        if (!resizable || e.button !== 0)
            return;
        isResizing.current = true;
        resizeDirection.current = direction;
        resizeStart.current = {
            width: state.size.width,
            height: state.size.height,
            x: e.clientX,
            y: e.clientY
        };
        e.preventDefault();
        e.stopPropagation();
    }; }, [resizable, state.size]);
    // Global mouse move handler
    (0, react_1.useEffect)(function () {
        var handleMouseMove = function (e) {
            if (isDragging.current) {
                var newX_1 = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - state.size.width));
                var newY_1 = Math.max(0, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 40));
                setState(function (prev) { return (__assign(__assign({}, prev), { position: { x: newX_1, y: newY_1 } })); });
            }
            if (isResizing.current) {
                var deltaX = e.clientX - resizeStart.current.x;
                var deltaY = e.clientY - resizeStart.current.y;
                var dir = resizeDirection.current;
                var newWidth_1 = resizeStart.current.width;
                var newHeight_1 = resizeStart.current.height;
                var newX_2 = state.position.x;
                var newY_2 = state.position.y;
                // Handle horizontal resizing
                if (dir.includes('e')) {
                    newWidth_1 = Math.max(minWidth, Math.min(resizeStart.current.width + deltaX, effectiveMaxWidth));
                }
                else if (dir.includes('w')) {
                    var potentialWidth = resizeStart.current.width - deltaX;
                    if (potentialWidth >= minWidth && potentialWidth <= effectiveMaxWidth) {
                        newWidth_1 = potentialWidth;
                        newX_2 = state.position.x + deltaX;
                    }
                }
                // Handle vertical resizing
                if (dir.includes('s')) {
                    newHeight_1 = Math.max(minHeight, Math.min(resizeStart.current.height + deltaY, effectiveMaxHeight));
                }
                else if (dir.includes('n')) {
                    var potentialHeight = resizeStart.current.height - deltaY;
                    if (potentialHeight >= minHeight && potentialHeight <= effectiveMaxHeight) {
                        newHeight_1 = potentialHeight;
                        newY_2 = state.position.y + deltaY;
                    }
                }
                setState(function (prev) { return (__assign(__assign({}, prev), { position: { x: newX_2, y: newY_2 }, size: { width: newWidth_1, height: newHeight_1 } })); });
            }
        };
        var handleMouseUp = function () {
            isDragging.current = false;
            isResizing.current = false;
            resizeDirection.current = '';
        };
        if (state.isVisible && !state.isMinimized) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return function () {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [state, minWidth, minHeight, effectiveMaxWidth, effectiveMaxHeight]);
    // Handle minimize/restore
    var handleMinimize = (0, react_1.useCallback)(function () {
        setState(function (prev) { return (__assign(__assign({}, prev), { isMinimized: !prev.isMinimized })); });
    }, []);
    // Handle close
    var handleClose = (0, react_1.useCallback)(function () {
        setState(function (prev) { return (__assign(__assign({}, prev), { isVisible: false })); });
        onClose === null || onClose === void 0 ? void 0 : onClose();
    }, [onClose]);
    // Calculate window styles
    var windowStyle = (0, react_1.useMemo)(function () { return (__assign({ left: state.position.x, top: state.position.y, width: state.isMinimized ? 250 : state.size.width, height: state.isMinimized ? 40 : state.size.height, zIndex: state.zIndex, display: state.isVisible ? 'flex' : 'none' }, style)); }, [state, style]);
    if (!state.isVisible) {
        return null;
    }
    return (<StyledWindow ref={windowRef} className={"floating-window ".concat(className || '')} style={windowStyle} elevation={8}>
      <TitleBar className="title-bar" onMouseDown={handleMouseDown}>
        <material_1.Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {title}
        </material_1.Typography>
        <material_1.Box sx={{ display: 'flex', gap: 0.5 }}>
          <material_1.IconButton size="small" onClick={handleMinimize} sx={{ color: 'inherit', padding: 0.5 }}>
            {state.isMinimized ? <icons_material_1.CropSquare fontSize="small"/> : <icons_material_1.Minimize fontSize="small"/>}
          </material_1.IconButton>
          <material_1.IconButton size="small" onClick={handleClose} sx={{ color: 'inherit', padding: 0.5 }}>
            <icons_material_1.Close fontSize="small"/>
          </material_1.IconButton>
        </material_1.Box>
      </TitleBar>

      {!state.isMinimized && (<>
          <WindowContent>
            {children}
          </WindowContent>

          {resizable && (<>
              <ResizeHandle className="resize-n" onMouseDown={handleResizeMouseDown('n')}/>
              <ResizeHandle className="resize-ne" onMouseDown={handleResizeMouseDown('ne')}/>
              <ResizeHandle className="resize-e" onMouseDown={handleResizeMouseDown('e')}/>
              <ResizeHandle className="resize-se" onMouseDown={handleResizeMouseDown('se')}/>
              <ResizeHandle className="resize-s" onMouseDown={handleResizeMouseDown('s')}/>
              <ResizeHandle className="resize-sw" onMouseDown={handleResizeMouseDown('sw')}/>
              <ResizeHandle className="resize-w" onMouseDown={handleResizeMouseDown('w')}/>
              <ResizeHandle className="resize-nw" onMouseDown={handleResizeMouseDown('nw')}/>
            </>)}
        </>)}
    </StyledWindow>);
};
exports.FloatingWindow = FloatingWindow;
