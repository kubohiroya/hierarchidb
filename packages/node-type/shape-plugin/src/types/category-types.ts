/**
  * Shape Plugin Category Types
   */

import React from 'react';
import {
  AccountBalance as AdministrativeIcon,
  Business as EconomicIcon,
  Map as GeographicIcon,
  Terrain as EnvironmentalIcon,
} from '@mui/icons-material';
import type { CategoryOption } from '@hierarchidb/folder-plugin/ui';

/**
  * ShapeCategory -
  */
export type ShapeCategory =
  | 'geographic'
  | 'administrative'
  | 'environmental'
  | 'economic';

/**
  * ShapeCategoryOption -
  */
export const SHAPE_CATEGORIES: CategoryOption<ShapeCategory>[] = [
  {
    value: 'geographic',
    label: '地理的境界',
    description: '国境、海岸線、山脈などの自然地理境界',
    icon: React.createElement(GeographicIcon),
    color: '#2196f3',
  },
  {
    value: 'administrative',
    label: '行政境界',
    description: '都道府県、市区町村などの行政区画',
    icon: React.createElement(AdministrativeIcon),
    color: '#ff9800',
  },
  {
    value: 'environmental',
    label: '環境データ',
    description: '気候区分、生態系、汚染状況などの環境情報',
    icon: React.createElement(EnvironmentalIcon),
    color: '#4caf50',
  },
  {
    value: 'economic',
    label: '経済データ',
    description: '産業地域、経済圏、商圏などの経済活動エリア',
    icon: React.createElement(EconomicIcon),
    color: '#9c27b0',
  },
];

/**
    */
export const DEFAULT_SHAPE_CATEGORY: ShapeCategory = 'administrative';

/**
    */
export const getCategoryOption = (category: ShapeCategory): CategoryOption<ShapeCategory> | undefined => {
  return SHAPE_CATEGORIES.find(option => option.value === category);
};

/**
    */
export const getCategoryLabel = (category: ShapeCategory): string => {
  const option = getCategoryOption(category);
  return option?.label || category;
};

/**
    */
export const getCategoryColor = (category: ShapeCategory): string => {
  const option = getCategoryOption(category);
  return option?.color || '#757575';
};