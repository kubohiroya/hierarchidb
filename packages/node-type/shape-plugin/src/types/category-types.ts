/**
 * Shape Plugin Category Types
 * 地理形状プラグインのカテゴリ定義
 */

import React from 'react';
import {
  Map as GeographicIcon,
  AccountBalance as AdministrativeIcon,
  Terrain as EnvironmentalIcon,
  Business as EconomicIcon,
} from '@mui/icons-material';
import type { CategoryOption } from '@hierarchidb/folder-plugin/ui';

/**
 * ShapeCategory - 地理形状カテゴリのブランド型
 */
export type ShapeCategory = 
  | 'geographic' 
  | 'administrative' 
  | 'environmental'
  | 'economic';

/**
 * ShapeCategoryOption - 地理形状カテゴリ選択肢の定義
 */
export const SHAPE_CATEGORIES: CategoryOption<ShapeCategory>[] = [
  {
    value: 'geographic',
    label: '地理的境界',
    description: '国境、海岸線、山脈などの自然地理境界',
    icon: React.createElement(GeographicIcon),
    color: '#2196f3'
  },
  {
    value: 'administrative',
    label: '行政境界',
    description: '都道府県、市区町村などの行政区画',
    icon: React.createElement(AdministrativeIcon),
    color: '#ff9800'
  },
  {
    value: 'environmental',
    label: '環境データ',
    description: '気候区分、生態系、汚染状況などの環境情報',
    icon: React.createElement(EnvironmentalIcon),
    color: '#4caf50'
  },
  {
    value: 'economic',
    label: '経済データ',
    description: '産業地域、経済圏、商圏などの経済活動エリア',
    icon: React.createElement(EconomicIcon),
    color: '#9c27b0'
  }
];

/**
 * デフォルトカテゴリ
 */
export const DEFAULT_SHAPE_CATEGORY: ShapeCategory = 'administrative';

/**
 * カテゴリからオプションを取得
 */
export const getCategoryOption = (category: ShapeCategory): CategoryOption<ShapeCategory> | undefined => {
  return SHAPE_CATEGORIES.find(option => option.value === category);
};

/**
 * カテゴリの表示名を取得
 */
export const getCategoryLabel = (category: ShapeCategory): string => {
  const option = getCategoryOption(category);
  return option?.label || category;
};

/**
 * カテゴリの色を取得
 */
export const getCategoryColor = (category: ShapeCategory): string => {
  const option = getCategoryOption(category);
  return option?.color || '#757575';
};