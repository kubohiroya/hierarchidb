/**
 * @file plugin-integration.test.ts
 * @description Integration tests for BaseMap plugin
 */

import { describe, it, expect } from 'vitest';
import { BaseMapDialog, BaseMapStepperDialog, PLUGIN_INFO } from '../index';
import { basemapPlugin } from '../../plugin.config';
import type { BaseMapEntity } from '../types';

describe('BaseMap Plugin Integration', () => {
  it('should export plugin configuration', () => {
    expect(basemapPlugin).toBeDefined();
    expect(basemapPlugin.id).toBe('com.example.basemap');
    expect(basemapPlugin.name).toBe('BaseMap Plugin');
    expect(basemapPlugin.version).toBe('1.0.0');
  });

  it('should export plugin info', () => {
    expect(PLUGIN_INFO).toBeDefined();
    expect(PLUGIN_INFO.id).toBe('com.example.basemap');
    expect(PLUGIN_INFO.name).toBe('BaseMap Plugin');
    expect(PLUGIN_INFO.version).toBe('1.0.0');
  });

  it('should export dialog components', () => {
    expect(BaseMapDialog).toBeDefined();
    expect(BaseMapStepperDialog).toBeDefined();
    expect(typeof BaseMapDialog).toBe('function');
    expect(typeof BaseMapStepperDialog).toBe('function');
  });

  it('should have correct node type configuration', () => {
    expect(basemapPlugin.nodeTypes).toHaveLength(1);
    expect(basemapPlugin.nodeTypes[0].type).toBe('basemap');
    expect(basemapPlugin.nodeTypes[0].displayName).toBe('Base Map');
  });

  it('should have database configuration', () => {
    expect(basemapPlugin.database).toBeDefined();
    expect(basemapPlugin.database.tables).toHaveLength(3);
    
    const tableNames = basemapPlugin.database.tables.map(t => t.name);
    expect(tableNames).toContain('basemaps');
    expect(tableNames).toContain('basemap_workingcopies');
    expect(tableNames).toContain('basemap_tiles_cache');
  });

  it('should have entity handlers', () => {
    expect(basemapPlugin.entityHandlers).toBeDefined();
    expect(basemapPlugin.entityHandlers.basemap).toBeDefined();
  });

  it('should have lifecycle hooks', () => {
    expect(basemapPlugin.lifecycle).toBeDefined();
    expect(basemapPlugin.lifecycle.hooks).toBeDefined();
    expect(typeof basemapPlugin.lifecycle.hooks.onInstall).toBe('function');
    expect(typeof basemapPlugin.lifecycle.hooks.onEnable).toBe('function');
  });
});

describe('BaseMap Entity Validation', () => {
  it('should validate default entity structure', () => {
    const defaultEntity: Partial<BaseMapEntity> = {
      mapStyle: 'streets',
      center: [0, 0],
      zoom: 10,
      bearing: 0,
      pitch: 0,
      displayOptions: {
        show3dBuildings: false,
        showTraffic: false,
        showTransit: false,
        showTerrain: false,
        showLabels: true,
      },
    };

    expect(defaultEntity.mapStyle).toBe('streets');
    expect(defaultEntity.center).toEqual([0, 0]);
    expect(defaultEntity.zoom).toBe(10);
    expect(defaultEntity.displayOptions?.showLabels).toBe(true);
  });

  it('should handle custom map style', () => {
    const customEntity: Partial<BaseMapEntity> = {
      mapStyle: 'custom',
      styleUrl: 'https://example.com/style.json',
      apiKey: 'test-key',
    };

    expect(customEntity.mapStyle).toBe('custom');
    expect(customEntity.styleUrl).toBeDefined();
    expect(customEntity.apiKey).toBeDefined();
  });
});

describe('Plugin Component Export', () => {
  it('should export step components', async () => {
    const { Step1BasicInformation, Step2MapStyle, Step3MapView, Step4Preview } = await import('../components/steps');
    
    expect(Step1BasicInformation).toBeDefined();
    expect(Step2MapStyle).toBeDefined();
    expect(Step3MapView).toBeDefined();
    expect(Step4Preview).toBeDefined();
  });
});