import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface UseResizableSidebarViewParams {
  setSidebarOpen: (value: boolean) => void;
}

export interface UseResizableSidebarViewResult {
  drawerRef: RefObject<HTMLDivElement | null>;
  drawerWidth: number;
  handleMouseDown: () => void;
  onClose: () => void;
}

export function useResizableSidebarView({
  setSidebarOpen,
}: UseResizableSidebarViewParams): UseResizableSidebarViewResult {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [minDrawerWidth, setMinDrawerWidth] = useState<number>(200);
  const [maxDrawerWidth, setMaxDrawerWidth] = useState<number>(200);
  const [drawerWidth, setDrawerWidth] = useState<number>(200);

  useLayoutEffect(() => {
    const baseWidth = drawerRef.current?.clientWidth ?? 200;
    setDrawerWidth(baseWidth);
    setMinDrawerWidth(baseWidth);
    setMaxDrawerWidth(document.body.clientWidth);
  }, []);

  const handleMouseMove = useCallback(
    (event: globalThis.MouseEvent) => {
      const newWidth = event.clientX - document.body.offsetLeft;
      if (newWidth > minDrawerWidth && newWidth < maxDrawerWidth) {
        setDrawerWidth(newWidth);
      }
    },
    [maxDrawerWidth, minDrawerWidth]
  );

  const handleMouseUp = useCallback(() => {
    document.removeEventListener('mouseup', handleMouseUp, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(() => {
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('mousemove', handleMouseMove, true);
  }, [handleMouseMove, handleMouseUp]);

  const onClose = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  return {
    drawerRef,
    drawerWidth,
    handleMouseDown,
    onClose,
  };
}
