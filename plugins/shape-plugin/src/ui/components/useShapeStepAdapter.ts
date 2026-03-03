import { useCallback, useEffect, useRef } from 'react';
import type { ShapeEntity } from '~/common/types/ShapeEntity';

const isSameShapeData = (
  left?: Partial<ShapeEntity> | null,
  right?: Partial<ShapeEntity> | null,
): boolean => {
  if (left === right) return true;
  if (left === null || left === undefined || right === null || right === undefined) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

type Args = {
  data?: Partial<ShapeEntity>;
  onChange: (next: Partial<ShapeEntity>) => void;
};

export const useShapeStepAdapter = ({ data, onChange }: Args) => {
  const latestDataRef = useRef<Partial<ShapeEntity> | undefined>(undefined);

  useEffect(() => {
    latestDataRef.current = {
      ...(latestDataRef.current ?? {}),
      ...(data ?? {}),
    };
  }, [data]);

  const handleChange = useCallback((updates: Partial<ShapeEntity>) => {
    const next = {
      ...(latestDataRef.current ?? {}),
      ...updates,
    } as Partial<ShapeEntity>;
    if (isSameShapeData(next, latestDataRef.current)) {
      return;
    }
    latestDataRef.current = next;
    onChange(next);
  }, [onChange]);

  return {
    data: ({
      ...(data ?? {}),
    }) as Partial<ShapeEntity>,
    handleChange,
  };
};
