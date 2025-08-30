/**
 * @file BaseMapPluginDefinition.ts
 * @description BaseMap plugin definition following standard structure
 */

import type { ExtendableNodeTypeDefinition } from '@hierarchidb/common-type';
import type { FolderEntity } from '@hierarchidb/node-type-folder-plugin';
import { BaseMapEntityHandler } from '../handlers/BaseMapEntityHandler';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../entities/BaseMapEntity';

export const BaseMapPluginDefinition: ExtendableNodeTypeDefinition<
  FolderEntity,
  BaseMapEntity,
  BaseMapWorkingCopy
> = {
  // Extension configuration
  extends: 'folder-plugin',
  nodeType: 'basemap-plugin',
  name: 'BaseMap Plugin',
  displayName: 'ベースマッププラグイン',
  
  // Entity handler
  entityHandler: new BaseMapEntityHandler(),
  
  // Database schema
  database: {
    entityStore: 'basemap_entities',
    schema: {
      '&id': 'EntityId',
      'nodeId': 'NodeId',
      'name, styleUrl, stylePreset': '',
      'center, zoom, bearing, pitch': '',
      'showAttribution, showNavigation, enableInteraction': '',
      'createdAt, updatedAt, version': '',
    },
    version: 1
  },
  
  // Extension steps
  extendedSteps: [
    { stepNumber: 2, title: 'マップスタイル', component: 'MapStyleStep' },
    { stepNumber: 3, title: 'ビューポート設定', component: 'MapViewportStep' },
    { stepNumber: 4, title: '表示オプション', component: 'DisplayOptionsStep' },
    { stepNumber: 5, title: 'プレビュー', component: 'PreviewStep' }
  ],
  
  // Extended fields
  extendedFields: [
    { name: 'styleUrl', type: 'string', required: true },
    { name: 'stylePreset', type: 'string', required: true },
    { name: 'center', type: 'array', required: true },
    { name: 'zoom', type: 'number', required: true },
    { name: 'bearing', type: 'number', required: false },
    { name: 'pitch', type: 'number', required: false },
    { name: 'showAttribution', type: 'boolean', required: false },
    { name: 'showNavigation', type: 'boolean', required: false },
    { name: 'enableInteraction', type: 'boolean', required: false }
  ],
  
  // Category settings
  category: {
    primary: 'visualization',
    secondary: 'mapping',
    treeTypes: ['data-tree', 'project-tree']
  },
  
  // Validation rules
  extendedValidation: {
    extendedRules: {
      validateCenter: (center: [number, number]) => {
        const [lng, lat] = center;
        return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
      },
      validateZoom: (zoom: number) => zoom >= 0 && zoom <= 24,
      validateBearing: (bearing: number) => bearing >= 0 && bearing <= 360,
      validatePitch: (pitch: number) => pitch >= 0 && pitch <= 60
    }
  }
};