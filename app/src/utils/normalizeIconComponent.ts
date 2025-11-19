import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';

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
    const candidate = value as Record<string, unknown> & {
      $$typeof?: unknown;
      render?: unknown;
      type?: unknown;
      default?: unknown;
    };

    if (typeof candidate.$$typeof === 'symbol' || typeof candidate.render === 'function') {
      return candidate as unknown as ComponentType<SvgIconProps>;
    }

    if (typeof candidate.type === 'function' || typeof candidate.type === 'object') {
      return candidate as unknown as ComponentType<SvgIconProps>;
    }

    if (typeof candidate.default !== 'undefined') {
      return normalizeIconComponent(candidate.default, seen);
    }
  }

  return null;
}
