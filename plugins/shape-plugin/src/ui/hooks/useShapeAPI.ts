import { useMemo } from 'react';
import type { ShapeAPI } from '../../common/types/api.js';

export function useShapeAPI(): Promise<ShapeAPI> {
  return useMemo(() => Promise.reject(new Error('Shape API is not available in the refactored UI yet.')), []);
}

export function useShapeAPIGetter(): () => Promise<ShapeAPI> {
  return useMemo(() => () => Promise.reject(new Error('Shape API getter is not available.')), []);
}
