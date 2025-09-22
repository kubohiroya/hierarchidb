/**
 * Download Strategy interfaces for Location plugin
 */
import type { LocationEntity, LocationSearchConfig } from '../../entities/LocationEntity.js';

export interface ILocationDownloadStrategy {
  readonly id: string;

  supports(config: LocationSearchConfig): boolean;

  search(config: LocationSearchConfig): Promise<LocationEntity[]>;
}

export interface StrategyRegistry {
  register(strategy: ILocationDownloadStrategy): void;

  resolve(config: LocationSearchConfig): ILocationDownloadStrategy | null;
}

