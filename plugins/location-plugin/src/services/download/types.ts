/**
 * Download Strategy interfaces for Location plugin
 */
import type { LocationSearchConfig } from '../../common/entities/LocationEntity.js';
import type { LocationPointProperties } from '../../common/entities/LocationPoint.js';

export interface ILocationDownloadStrategy {
  readonly id: string;

  supports(config: LocationSearchConfig): boolean;

  search(config: LocationSearchConfig): Promise<LocationPointProperties[]>;
}

export interface StrategyRegistry {
  register(strategy: ILocationDownloadStrategy): void;

  resolve(config: LocationSearchConfig): ILocationDownloadStrategy | null;
}
