import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';

export function normalizeIconComponent(
  value: unknown,
  seen: Set<unknown> = new Set()
): ComponentType<SvgIconProps> | null {
  if (!value) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (typeof value === 'function') {
    return value as ComponentType<SvgIconProps>;
  }

  if (typeof value === 'object') {
    const candidate = value;

    if (
      typeof Reflect.get(candidate, '$$typeof') === 'symbol' ||
      typeof Reflect.get(candidate, 'render') === 'function'
    ) {
      return value as ComponentType<SvgIconProps>;
    }

    if (
      typeof Reflect.get(candidate, 'type') === 'function' ||
      typeof Reflect.get(candidate, 'type') === 'object'
    ) {
      return value as ComponentType<SvgIconProps>;
    }

    const defaultValue = Reflect.get(candidate, 'default');
    if (typeof defaultValue !== 'undefined') {
      return normalizeIconComponent(defaultValue, seen);
    }
  }

  return null;
}
