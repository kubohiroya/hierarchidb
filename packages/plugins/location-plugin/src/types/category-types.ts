/**
  * Location Plugin Category Types
   */

import type { LocationCategory } from '../entities/LocationEntity.js';

//  JSX
interface CategoryOption<T = string> {
  value: T;
  label: string;
  description: string;
  icon?: string;
  color: string;
}

/**
  * LocationCategoryOption -
  */
export const LOCATION_CATEGORIES: CategoryOption<LocationCategory>[] = [
  {
    value: 'transportation',
    label: '交通機関',
    description: '空港、駅、港湾などの交通関連施設',
    icon: '✈️',
    color: '#2196f3',
  },
  {
    value: 'administrative',
    label: '行政機関',
    description: '役所、官公庁、行政サービス施設',
    icon: '🏛️',
    color: '#ff9800',
  },
  {
    value: 'infrastructure',
    label: 'インフラ',
    description: '発電所、浄水場、通信施設などの社会基盤',
    icon: '🚂',
    color: '#4caf50',
  },
];

/**
    */
export const DEFAULT_LOCATION_CATEGORY: LocationCategory = 'transportation';

/**
    */
export const getCategoryOption = (category: LocationCategory): CategoryOption<LocationCategory> | undefined => {
  return LOCATION_CATEGORIES.find(option => option.value === category);
};

/**
    */
export const getCategoryLabel = (category: LocationCategory): string => {
  const option = getCategoryOption(category);
  return option?.label || category;
};

/**
    */
export const getCategoryColor = (category: LocationCategory): string => {
  const option = getCategoryOption(category);
  return option?.color || '#757575';
};
