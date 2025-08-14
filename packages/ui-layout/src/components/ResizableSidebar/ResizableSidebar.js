import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
/**
 * @file ResizableSidebar.tsx
 * @description A resizable sidebar component that provides a draggable panel interface.
 * Features include mouse-driven width adjustment with drag handle, automatic width
 * constraints, and smooth open/close transitions.
 *
 * @module components/ui/ResizableSidebar
 *
 * @usage
 * - App layout sidebars (e.g., AppSidebar, ShapesSidebar)
 * - Resource management panels
 * - Any panel requiring user-adjustable width
 *
 * @dependencies
 * - @mui/material: Drawer, Box, Stack components and styling
 * - @mui/icons-material: DragIndicator icon
 * - React: hooks (useState, useRef, useLayoutEffect, useCallback)
 */
import { Box, Drawer, Stack, styled } from '@mui/material';
import { DragIndicator } from '@mui/icons-material';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
const DragHandleBox = styled(Box)`
  width: 10px;
  height: 100vh;
  cursor: ew-resize;
  padding: 0;
  border-top: 1px solid #eee;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background-color: #eee;
  color: #bbb;
  align-content: center;
`;
const DragHandle = ({ onMouseDown }) =>
  _jsx(DragHandleBox, {
    onMouseDown: onMouseDown,
    children: _jsx(DragIndicator, { style: { marginLeft: '-8px' } }),
  });
export const ResizableSidebar = ({
  children,
  sidebarOpen,
  setSidebarOpen,
  //sidebarInert,
}) => {
  const ref = useRef(null);
  const [minDrawerWidth, setMinDrawerWidth] = useState(200);
  const [maxDrawerWidth, setMaxDrawerWidth] = useState(200);
  const [drawerWidth, setDrawerWidth] = useState(200);
  useLayoutEffect(() => {
    setDrawerWidth(ref.current?.clientWidth ?? 200);
    setMinDrawerWidth(ref.current?.clientWidth ?? 200);
    setMaxDrawerWidth(document.body.clientWidth);
  }, []);
  const handleMouseDown = () => {
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('mousemove', handleMouseMove, true);
  };
  const handleMouseUp = () => {
    document.removeEventListener('mouseup', handleMouseUp, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
  };
  const handleMouseMove = useCallback(
    (ev) => {
      const newWidth = ev.clientX - document.body.offsetLeft;
      if (newWidth > minDrawerWidth && newWidth < maxDrawerWidth) {
        setDrawerWidth(newWidth);
      }
    },
    [minDrawerWidth, maxDrawerWidth]
  );
  const onClose = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  return _jsx(Drawer, {
    ref: ref,
    variant: 'temporary',
    anchor: 'left',
    open: sidebarOpen,
    keepMounted: true,
    onClose: onClose,
    ModalProps: {
      keepMounted: true,
      disableScrollLock: true,
      container: document.body,
      BackdropProps: {
        invisible: true,
      },
    },
    children: _jsxs(Stack, {
      direction: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      sx: { padding: 1, width: drawerWidth - 5 },
      role: 'region',
      'aria-label': 'sidebar',
      children: [children, _jsx(DragHandle, { onMouseDown: handleMouseDown })],
    }),
  });
};
//# sourceMappingURL=ResizableSidebar.js.map
