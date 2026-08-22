/**
 * @file WindowState.ts
 * @description Window atoms types for floating window
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WindowState {
  position: Position;
  size: Size;
  isMinimized: boolean;
  isFullscreen?: boolean;
  isVisible: boolean;
  zIndex?: number;
}

export interface WindowConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

import type React from 'react';

export interface FloatingWindowProps {
  title: string;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  initialState?: Partial<WindowState>;
  onStateChange?: (state: WindowState) => void;
  onRequestFocus?: () => void;
  onClose?: () => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;
  draggable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
