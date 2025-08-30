/**
 * Location Plugin Category Types
 * 地点情報プラグインのカテゴリ定義
 */

// 簡素化された型定義（JSX構文を避ける）
interface CategoryOption<T = string> {
  value: T;
  label: string;
  description: string;
  icon?: string;
  color: string;
}

/**
 * LocationCategory - 地点カテゴリのブランド型
 */
export type LocationCategory = 
  | 'transportation' 
  | 'administrative' 
  | 'infrastructure';

/**
 * LocationCategoryOption - 地点カテゴリ選択肢の定義
 */
export const LOCATION_CATEGORIES: CategoryOption<LocationCategory>[] = [
  {
    value: 'transportation',
    label: '交通機関',
    description: '空港、駅、港湾などの交通関連施設',
    icon: '✈️',
    color: '#2196f3'
  },
  {
    value: 'administrative',
    label: '行政機関',
    description: '役所、官公庁、行政サービス施設',
    icon: '🏛️',
    color: '#ff9800'
  },
  {
    value: 'infrastructure',
    label: 'インフラ',
    description: '発電所、浄水場、通信施設などの社会基盤',
    icon: '🚂',
    color: '#4caf50'
  }
];

/**
 * デフォルトカテゴリ
 */
export const DEFAULT_LOCATION_CATEGORY: LocationCategory = 'transportation';

/**
 * カテゴリからオプションを取得
 */
export const getCategoryOption = (category: LocationCategory): CategoryOption<LocationCategory> | undefined => {
  return LOCATION_CATEGORIES.find(option => option.value === category);
};

/**
 * カテゴリの表示名を取得
 */
export const getCategoryLabel = (category: LocationCategory): string => {
  const option = getCategoryOption(category);
  return option?.label || category;
};

/**
 * カテゴリの色を取得
 */
export const getCategoryColor = (category: LocationCategory): string => {
  const option = getCategoryOption(category);
  return option?.color || '#757575';
};