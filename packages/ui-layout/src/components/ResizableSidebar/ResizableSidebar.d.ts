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
import { type ReactNode } from 'react';
export declare const ResizableSidebar: ({
  children,
  sidebarOpen,
  setSidebarOpen,
}: {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
}) => import('react/jsx-runtime').JSX.Element;
//# sourceMappingURL=ResizableSidebar.d.ts.map
