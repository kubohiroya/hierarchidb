/**
 * @file useFloatingWindow.ts
 * @description Custom hook for managing floating window atoms
 */

 
import { useCallback, useEffect, useState } from 'react';
import type { Position, Size, WindowState } from '../types/WindowState.js';

export interface UseFloatingWindowOptions {
  initialPosition?: Position;
  initialSize?: Size;
  persistKey?: string;
  onStateChange?: (state: WindowState) => void;
}

export interface UseFloatingWindowResult {
  windowState: WindowState;
  handlers: {
    onStateChange: (state: WindowState) => void;
    onClose: () => void;
    onMinimize: () => void;
    onRestore: () => void;
    setPosition: (position: Position) => void;
    setSize: (size: Size) => void;
    show: () => void;
    hide: () => void;
  };
}

export function useFloatingWindow(options: UseFloatingWindowOptions = {}): UseFloatingWindowResult {
  const {
    initialPosition = { x: 100, y: 100 },
    initialSize = { width: 400, height: 300 },
    persistKey,
    onStateChange: externalOnStateChange,
  } = options;

  // Load persisted atoms if available
  const loadPersistedState = useCallback((): Partial<WindowState> | null => {
    if (!persistKey) return null;

    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load persisted window state:', error);
    }
    return null;
  }, [persistKey]);

  // Initialize atoms
  const [windowState, setWindowState] = useState<WindowState>(() => {
    const persisted = loadPersistedState();
    return {
      position: persisted?.position || initialPosition,
      size: persisted?.size || initialSize,
      isMinimized: persisted?.isMinimized || false,
      isFullscreen: persisted?.isFullscreen || false,
      isVisible: persisted?.isVisible !== false,
      zIndex: persisted?.zIndex || 1000,
    };
  });

  // Persist atoms when it changes
  useEffect(() => {
    if (persistKey) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(windowState));
      } catch (error) {
        console.error('Failed to persist window state:', error);
      }
    }
  }, [windowState, persistKey]);

  // Notify external listener of atoms changes
  useEffect(() => {
    externalOnStateChange?.(windowState);
  }, [windowState, externalOnStateChange]);

  // Handler for atoms changes from the FloatingWindow component
  const onStateChange = useCallback((newState: WindowState) => {
    setWindowState(newState);
  }, []);

  // Handler for closing the window
  const onClose = useCallback(() => {
    setWindowState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Handler for minimizing the window
  const onMinimize = useCallback(() => {
    setWindowState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  // Handler for restoring the window
  const onRestore = useCallback(() => {
    setWindowState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  // Handler for setting position
  const setPosition = useCallback((position: Position) => {
    setWindowState(prev => ({ ...prev, position }));
  }, []);

  // Handler for setting size
  const setSize = useCallback((size: Size) => {
    setWindowState(prev => ({ ...prev, size }));
  }, []);

  // Handler for showing the window
  const show = useCallback(() => {
    setWindowState(prev => ({ ...prev, isVisible: true }));
  }, []);

  // Handler for hiding the window
  const hide = useCallback(() => {
    setWindowState(prev => ({ ...prev, isVisible: false }));
  }, []);

  return {
    windowState,
    handlers: {
      onStateChange,
      onClose,
      onMinimize,
      onRestore,
      setPosition,
      setSize,
      show,
      hide,
    },
  };
}
