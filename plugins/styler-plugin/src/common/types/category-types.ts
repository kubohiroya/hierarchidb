/**
 * StylemapCategory -
 */

export type StylemapCategory =
  | 'choropleth'
  | 'symbol'
  | 'heatmap'
  | 'cluster'
  | 'graduated'
  | 'categorized'
  | 'terrain'
  | 'network'
  | 'flow'
  | 'custom';

export interface StylemapCategoryConfig {
  value: StylemapCategory;
  label: string;
  color: string;
  description?: string;
}

/**
 */
export const STYLEMAP_CATEGORY_CONFIGS: StylemapCategoryConfig[] = [
  {
    value: 'choropleth',
    label: 'Choropleth Map',
    color: '#4CAF50',
    description: 'Color-coded areas based on data values',
  },
  {
    value: 'symbol',
    label: 'Symbol Map',
    color: '#2196F3',
    description: 'Point symbols representing data',
  },
  {
    value: 'heatmap',
    label: 'Heat Map',
    color: '#FF5722',
    description: 'Density visualization using color gradients',
  },
  {
    value: 'cluster',
    label: 'Cluster Map',
    color: '#9C27B0',
    description: 'Grouped point visualization',
  },
  {
    value: 'graduated',
    label: 'Graduated Symbols',
    color: '#FF9800',
    description: 'Symbols scaled by data values',
  },
  {
    value: 'categorized',
    label: 'Categorized Map',
    color: '#607D8B',
    description: 'Different styles for different categories',
  },
  {
    value: 'terrain',
    label: 'Terrain Visualization',
    color: '#8BC34A',
    description: 'Topographic and elevation data',
  },
  {
    value: 'network',
    label: 'Network Map',
    color: '#E91E63',
    description: 'Connected lines and nodes',
  },
  {
    value: 'flow',
    label: 'Flow Map',
    color: '#00BCD4',
    description: 'Movement and flow visualization',
  },
  {
    value: 'custom',
    label: 'Custom Style',
    color: '#795548',
    description: 'User-defined styling',
  },
];
