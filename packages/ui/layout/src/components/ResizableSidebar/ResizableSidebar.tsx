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
 * - @mui/material: Drawer, Box, Stack containers and styling
 * - @mui/icon-material: DragIndicator icon
 * - React: hooks (useState, useRef, useLayoutEffect, useCallback)
 */

import { DragIndicator } from '@mui/icons-material';
import { Box, Drawer, Stack, styled } from '@mui/material';
import React, { type ReactNode } from 'react';
import { useResizableSidebarView } from './useResizableSidebarView.js';

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

const DragHandle = ({
  onMouseDown,
}: {
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}) => (
  <DragHandleBox onMouseDown={onMouseDown}>
    <DragIndicator style={{ marginLeft: '-8px' }} />
  </DragHandleBox>
);

export const ResizableSidebar = ({
  children,
  sidebarOpen,
  setSidebarOpen,
  //sidebarInert,
}: {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  //sidebarInert: boolean;
}) => {
  const { drawerRef, drawerWidth, handleMouseDown, onClose } = useResizableSidebarView({
    setSidebarOpen,
  });

  return (
    <Drawer
      ref={drawerRef}
      variant="temporary"
      anchor="left"
      open={sidebarOpen}
      keepMounted
      onClose={onClose}
      ModalProps={{
        keepMounted: true,
        disableScrollLock: true,
        container: document.body,
        BackdropProps: {
          invisible: true,
        },
      }}
      /*
      PaperProps={{
        style: { width: drawerWidth, position: "absolute", height: "100%" },
        component: "div",
        elevation: 1,
        tabIndex: -1,
        role: "presentation",
      }}
       */
    >
      <Stack
        component="section"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ padding: 1, width: drawerWidth - 5 }}
        aria-label="sidebar"
      >
        {children}
        <DragHandle onMouseDown={handleMouseDown} />
      </Stack>
    </Drawer>
  );
};
