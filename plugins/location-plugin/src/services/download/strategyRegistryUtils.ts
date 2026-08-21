import type { LocationSearchConfig } from '~/common/entities/LocationEntity';
import type { ILocationDownloadStrategy } from './types.js';

const strategies: ILocationDownloadStrategy[] = [];

export function registerLocationStrategy(strategy: ILocationDownloadStrategy): void {
  if (!strategies.find((s) => s.id === strategy.id)) {
    strategies.push(strategy);
  }
}

export function getLocationStrategy(
  config: LocationSearchConfig
): ILocationDownloadStrategy | null {
  for (const s of strategies) {
    if (s.supports(config)) return s;
  }
  return null;
}
