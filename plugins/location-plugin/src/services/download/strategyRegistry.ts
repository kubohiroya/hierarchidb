import type { ILocationDownloadStrategy } from './types.js';
import type { LocationSearchConfig } from '~/common/entities/LocationEntity';

const strategies: ILocationDownloadStrategy[] = [];

export function registerLocationStrategy(strategy: ILocationDownloadStrategy): void {
  if (!strategies.find((s) => s.id === strategy.id)) {
    strategies.push(strategy);
  }
}

export function getLocationStrategy(config: LocationSearchConfig): ILocationDownloadStrategy | null {
  for (const s of strategies) {
    try {
      if (s.supports(config)) return s;
    } catch {
      // Ignore strategy errors to allow fallbacks.
    }
  }
  return null;
}
