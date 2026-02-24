import { useCallback, useEffect, useRef, useState } from 'react';

export interface FramePlayerOptions {
  length: number;
  initialIndex?: number;
  initialFps?: number; // frames per second
  loop?: boolean;
  onIndex?: (index: number) => void;
}

export function useFramePlayer({ length, initialIndex = 0, initialFps = 12, loop = true, onIndex }: FramePlayerOptions) {
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, length - 1)));
  const [fps, setFps] = useState(initialFps);
  const [playing, setPlaying] = useState(false);
  const [isLoop, setLoop] = useState(loop);
  const timerRef = useRef<number | null>(null);

  const clamp = useCallback((i: number) => (length <= 0 ? 0 : Math.max(0, Math.min(length - 1, i))), [length]);

  const goTo = useCallback((i: number) => {
    const nv = clamp(i);
    setIndex(nv);
    onIndex?.(nv);
  }, [clamp, onIndex]);

  const next = useCallback(() => {
    if (length <= 0) return;
    if (index + 1 < length) goTo(index + 1); else if (isLoop) goTo(0);
  }, [index, length, isLoop, goTo]);

  const prev = useCallback(() => {
    if (length <= 0) return;
    if (index - 1 >= 0) goTo(index - 1); else if (isLoop) goTo(Math.max(0, length - 1));
  }, [index, length, isLoop, goTo]);

  // interval-based player (simple, accurate enough for UI preview)
  useEffect(() => {
    if (!playing) return;
    const interval = Math.max(16, Math.floor(1000 / Math.max(1, fps)));
    const id = window.setInterval(() => {
      // Using latest index via functional update to avoid stale closured value
      setIndex((cur) => {
        const atEnd = cur + 1 >= length;
        const nv = atEnd ? (isLoop ? 0 : cur) : cur + 1;
        if (!atEnd || isLoop) onIndex?.(nv);
        return nv;
      });
    }, interval);
    timerRef.current = id as number;
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, fps, length, isLoop, onIndex]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  useEffect(() => { onIndex?.(index); }, []); // report initial

  return {
    index,
    setIndex: goTo,
    fps, setFps,
    playing, play, pause,
    loop: isLoop, setLoop,
    next, prev,
  } as const;
}

