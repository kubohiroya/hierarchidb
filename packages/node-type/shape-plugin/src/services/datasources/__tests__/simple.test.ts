/**
  * - Vitest
  */

import { describe, expect, it } from 'vitest';
import { DataSourceStrategyFactory } from '../DataSourceStrategyFactory';

describe('Data Source Strategy Simple Test', () => {
  it('should create factory', () => {
    const factory = new DataSourceStrategyFactory();
    expect(factory).toBeDefined();
  });

  it('should have default strategies', () => {
    const factory = new DataSourceStrategyFactory();
    const strategies = factory.getAvailableStrategies();

    expect(strategies).toContain('natural-earth-shapes');
    expect(strategies).toContain('gadm-administrative-areas');
    expect(strategies).toContain('openstreetmap-overpass');
    expect(strategies).toContain('geoboundaries-admin-areas');
  });

  it('should create strategy instances', () => {
    const factory = new DataSourceStrategyFactory();

    const neStrategy = factory.create('natural-earth-shapes');
    expect(neStrategy.id).toBe('natural-earth-shapes');
    expect(neStrategy.name).toBe('Natural Earth Vector Data');

    const gadmStrategy = factory.create('gadm-administrative-areas');
    expect(gadmStrategy.id).toBe('gadm-administrative-areas');
    expect(gadmStrategy.name).toBe('GADM Administrative Areas');
  });

  it('should provide strategy info', () => {
    const factory = new DataSourceStrategyFactory();

    const info = factory.getStrategyInfo('natural-earth-shapes');
    expect(info?.name).toBe('Natural Earth');
    expect(info?.category).toBe('general');
    expect(info?.supported).toBe(true);
  });

  it('should filter strategies by category', () => {
    const factory = new DataSourceStrategyFactory();

    const adminStrategies = factory.getStrategiesByCategory('administrative');
    expect(adminStrategies).toContain('gadm-administrative-areas');
    expect(adminStrategies).toContain('geoboundaries-admin-areas');

    const generalStrategies = factory.getStrategiesByCategory('general');
    expect(generalStrategies).toContain('natural-earth-shapes');
    expect(generalStrategies).toContain('openstreetmap-overpass');
  });

  it('should provide recommendations', () => {
    const factory = new DataSourceStrategyFactory();

    const adminRec = factory.getRecommendedStrategy('administrative');
    expect(['gadm-administrative-areas', 'geoboundaries-admin-areas']).toContain(adminRec);

    const naturalRec = factory.getRecommendedStrategy('natural');
    expect(naturalRec).toBe('natural-earth-shapes');

    const realtimeRec = factory.getRecommendedStrategy('realtime');
    expect(realtimeRec).toBe('openstreetmap-overpass');
  });

  it('should provide statistics', () => {
    const factory = new DataSourceStrategyFactory();
    const stats = factory.getStatistics();

    expect(stats.total).toBe(4);
    expect(stats.supported).toBe(4);
    expect(stats.byCategory.general).toBe(2);
    expect(stats.byCategory.administrative).toBe(2);
    expect(stats.byCoverageLevel.global).toBe(4);
  });
});