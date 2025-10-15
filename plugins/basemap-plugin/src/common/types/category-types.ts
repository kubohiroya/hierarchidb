/**
 * @file category-lifecycle-plugin-definition.ts
 * @description Category type definitions for basemap plugin
 */

/**
     */
export type BasemapCategory = 'satellite' | 'street' | 'terrain' | 'dark' | 'light' | 'custom';

/**
    */
export interface BasemapCategoryConfig {
  value: BasemapCategory;
  label: string;
  color: string;
  description?: string;
}

/**
    */
export const BASEMAP_CATEGORIES: BasemapCategoryConfig[] = [
  {
    value: 'satellite',
    label: 'Satellite',
    color: '#4CAF50',
    description: 'Satellite imagery and aerial photography',
  },
  {
    value: 'street',
    label: 'Street Map',
    color: '#2196F3',
    description: 'Traditional street maps with roads and labels',
  },
  {
    value: 'terrain',
    label: 'Terrain',
    color: '#8BC34A',
    description: 'Topographic maps showing elevation and terrain',
  },
  {
    value: 'dark',
    label: 'Dark Theme',
    color: '#424242',
    description: 'Dark-themed maps for low-light environments',
  },
  {
    value: 'light',
    label: 'Light Theme',
    color: '#F5F5F5',
    description: 'Light-themed maps with minimal styling',
  },
  {
    value: 'custom',
    label: 'Custom',
    color: '#FF9800',
    description: 'Custom-styled maps with unique themes',
  },
];
