import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  PauseCircle as PauseCircleIcon,
  PauseCircleOutline as PauseCircleOutlineIcon,
  PlayCircle as PlayCircleIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import type { PaneHeaderComponentProps } from './PaneHeader.js';

interface UsePaneHeaderViewArgs extends PaneHeaderComponentProps {}

export const usePaneHeaderView = ({
  pane,
  state,
  progress,
  onToggle,
  clickable = true,
  vertical = false,
  onClick,
}: UsePaneHeaderViewArgs) => {
  const theme = useTheme();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const compactBreakpoint = 220;
  const countBreakpoint = 260;
  const isCompact = headerWidth > 0 && headerWidth < compactBreakpoint;
  const showCounts = headerWidth >= countBreakpoint;

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (clickable) {
      onToggle(pane.id);
    }
  };

  useEffect(() => {
    if (!headerRef.current || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setHeaderWidth(entry.contentRect.width);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleIcon = useMemo(() => {
    if (vertical) {
      return state.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />;
    }
    return state.isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />;
  }, [state.isExpanded, vertical]);

  const statusIcon = useMemo(() => {
    if (!progress) return null;
    const summaryTotal = progress.summary?.total ?? 0;
    const isZeroTasks = summaryTotal === 0
      || ((progress.taskCount ?? 0) === 0 && (progress.completedCount ?? 0) === 0);
    const status = progress.status;
    if (status === 'failed') return <ErrorOutlineIcon fontSize="small" />;
    if (isZeroTasks) return <PauseCircleOutlineIcon fontSize="small" />;
    if (status === 'running') return <PlayCircleIcon fontSize="small" />;
    if (status === 'paused') return <PauseCircleIcon fontSize="small" />;
    if (status === 'completed' || progress.progress >= 100) return <CheckCircleIcon fontSize="small" />;
    if (status === 'idle') return <PauseCircleOutlineIcon fontSize="small" />;
    if (progress.progress > 0) return <AutorenewIcon fontSize="small" />;
    return <PauseCircleOutlineIcon fontSize="small" />;
  }, [progress]);

  const statusColor = useMemo(() => {
    if (!progress) return theme.palette.text.secondary;
    const summaryTotal = progress.summary?.total ?? 0;
    const isZeroTasks = summaryTotal === 0
      || ((progress.taskCount ?? 0) === 0 && (progress.completedCount ?? 0) === 0);
    if (progress.status === 'failed') return theme.palette.error.main;
    if (isZeroTasks) return theme.palette.text.secondary;
    switch (progress.status) {
      case 'running':
        return theme.palette.primary.main;
      case 'paused':
        return theme.palette.warning.main;
      case 'completed':
        return theme.palette.success.main;
      default:
        return theme.palette.text.secondary;
    }
  }, [progress, theme.palette]);

  return {
    theme,
    headerRef,
    isCompact,
    showCounts,
    toggleIcon,
    statusIcon,
    statusColor,
    handleClick,
  };
};
