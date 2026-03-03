import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAutoHideFullScreenDialogViewParams {
  autoHide: boolean;
  autoHideDelay: number;
}

export interface UseAutoHideFullScreenDialogViewResult {
  headerVisible: boolean;
  footerVisible: boolean;
  handleHeaderMouseEnter: () => void;
  handleHeaderMouseLeave: () => void;
  handleFooterMouseEnter: () => void;
  handleFooterMouseLeave: () => void;
}

export function useAutoHideFullScreenDialogView({
  autoHide,
  autoHideDelay,
}: UseAutoHideFullScreenDialogViewParams): UseAutoHideFullScreenDialogViewResult {
  const [headerVisible, setHeaderVisible] = useState(!autoHide);
  const [footerVisible, setFooterVisible] = useState(!autoHide);
  const headerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const footerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHeaderTimeout = useCallback(() => {
    if (headerTimeoutRef.current) {
      clearTimeout(headerTimeoutRef.current);
      headerTimeoutRef.current = null;
    }
  }, []);

  const clearFooterTimeout = useCallback(() => {
    if (footerTimeoutRef.current) {
      clearTimeout(footerTimeoutRef.current);
      footerTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!autoHide) {
      clearHeaderTimeout();
      clearFooterTimeout();
      setHeaderVisible(true);
      setFooterVisible(true);
    }
  }, [autoHide, clearFooterTimeout, clearHeaderTimeout]);

  useEffect(() => {
    return () => {
      clearHeaderTimeout();
      clearFooterTimeout();
    };
  }, [clearFooterTimeout, clearHeaderTimeout]);

  const handleHeaderMouseEnter = useCallback(() => {
    if (!autoHide) return;
    clearHeaderTimeout();
    setHeaderVisible(true);
  }, [autoHide, clearHeaderTimeout]);

  const handleHeaderMouseLeave = useCallback(() => {
    if (!autoHide) return;
    clearHeaderTimeout();
    headerTimeoutRef.current = setTimeout(() => {
      setHeaderVisible(false);
    }, autoHideDelay);
  }, [autoHide, autoHideDelay, clearHeaderTimeout]);

  const handleFooterMouseEnter = useCallback(() => {
    if (!autoHide) return;
    clearFooterTimeout();
    setFooterVisible(true);
  }, [autoHide, clearFooterTimeout]);

  const handleFooterMouseLeave = useCallback(() => {
    if (!autoHide) return;
    clearFooterTimeout();
    footerTimeoutRef.current = setTimeout(() => {
      setFooterVisible(false);
    }, autoHideDelay);
  }, [autoHide, autoHideDelay, clearFooterTimeout]);

  return {
    headerVisible,
    footerVisible,
    handleHeaderMouseEnter,
    handleHeaderMouseLeave,
    handleFooterMouseEnter,
    handleFooterMouseLeave,
  };
}
