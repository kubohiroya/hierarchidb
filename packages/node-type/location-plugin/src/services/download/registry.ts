import type { LocationSearchConfig } from '../../entities/LocationEntity';
import type { ILocationDownloadStrategy, StrategyRegistry } from './types';
import { NominatimStrategy } from './strategies/nominatim';
import { OverpassStrategy } from './strategies/overpass';

class InMemoryStrategyRegistry implements StrategyRegistry {
  private strategies: ILocationDownloadStrategy[] = [];

  register(strategy: ILocationDownloadStrategy): void {
    this.strategies.push(strategy);
  }

  resolve(config: LocationSearchConfig): ILocationDownloadStrategy | null {
    return this.strategies.find((s) => s.supports(config)) ?? null;
  }
}

const defaultRegistry = new InMemoryStrategyRegistry();
// Register default strategies
defaultRegistry.register(new NominatimStrategy());
defaultRegistry.register(new OverpassStrategy());

export function getLocationStrategy(config: LocationSearchConfig): ILocationDownloadStrategy | null {
  // Feature flag gate (env or global FEATURE_FLAGS)
  const enabled =
    (typeof process !== 'undefined' && process?.env?.LOCATION_DOWNLOAD_STRATEGY === '1') ||
    (typeof globalThis !== 'undefined' && (globalThis as any)?.FEATURE_FLAGS?.LOCATION_DOWNLOAD_STRATEGY === true);
  if (!enabled) return null;
  return defaultRegistry.resolve(config);
}

