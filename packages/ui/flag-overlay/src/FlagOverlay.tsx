import type { CSSProperties } from 'react';

import { resolveFlagSymbol } from './flagEmoji';

export interface FlagOverlayItem {
  isoCode: string;
  x: number;
  y: number;
  size?: number;
  opacity?: number;
  rotationDeg?: number;
  className?: string;
  fallbackSymbol?: string;
}

export interface FlagOverlayProps {
  items: readonly FlagOverlayItem[];
  width: number | string;
  height: number | string;
  defaultFlagSize?: number;
  fallbackSymbol?: string;
  className?: string;
  style?: CSSProperties;
}

export function FlagOverlay({
  items,
  width,
  height,
  defaultFlagSize = 18,
  fallbackSymbol,
  className,
  style,
}: FlagOverlayProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        ...style,
      }}
    >
      {items.map((item, index) => {
        const fontSize = item.size ?? defaultFlagSize;
        const symbol = resolveFlagSymbol(item.isoCode, {
          fallbackSymbol: item.fallbackSymbol ?? fallbackSymbol,
        });

        return (
          <span
            key={`${item.isoCode}-${item.x}-${item.y}-${index}`}
            role="img"
            aria-label={item.isoCode}
            className={item.className}
            style={{
              position: 'absolute',
              left: `${item.x}px`,
              top: `${item.y}px`,
              fontSize: `${fontSize}px`,
              lineHeight: 1,
              opacity: item.opacity ?? 1,
              zIndex: index,
              transform: item.rotationDeg ? `rotate(${item.rotationDeg}deg)` : undefined,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {symbol}
          </span>
        );
      })}
    </div>
  );
}
