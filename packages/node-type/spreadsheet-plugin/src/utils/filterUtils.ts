/**
 * @file filterUtils.ts
 * @description CSV data filtering utilities
 * Refactored from StyleMap plugin for Spreadsheet plugin use
 */

import type { CSVFilterRule } from '@hierarchidb/ui-csv-extract';

/**
 * 【機能概要】: CSVデータにフィルタルールを適用
 * 【実装方針】: 複数フィルタのAND条件での適用
 * 【テスト対応】: 各種フィルタオペレータでの正確性テスト
 * 🟢 信頼性レベル: 実証済みフィルタロジック
 */
export function applyCsvFilters(
  rows: Array<Record<string, any>>,
  filters: CSVFilterRule[]
): Array<Record<string, any>> {
  if (!filters || filters.length === 0) {
    return rows;
  }

  // 【有効フィルタ抽出】: enabled=trueのフィルタのみ適用
  const activeFilters = filters.filter(filter => filter.enabled);
  
  if (activeFilters.length === 0) {
    return rows;
  }

  // 【フィルタ適用】: 各行に対して全フィルタをAND条件で適用
  return rows.filter(row => {
    return activeFilters.every(filter => applyFilterToRow(row, filter));
  });
}

/**
 * 【機能概要】: 単一行に対するフィルタ適用
 * 【実装方針】: オペレータ別の判定ロジック
 * 【テスト対応】: 各オペレータでの境界値テスト
 * 🟢 信頼性レベル: 網羅的なオペレータ対応
 */
function applyFilterToRow(row: Record<string, any>, filter: CSVFilterRule): boolean {
  const cellValue = row[filter.column];
  const filterValue = filter.value;

  // 【null値処理】: セル値がnull/undefinedの場合の特別処理
  if (cellValue == null) {
    switch (filter.operator) {
      case 'is_null':
        return true;
      case 'is_not_null':
        return false;
      default:
        return false; // null値は他の条件には一致しない
    }
  }

  // 【型変換】: セル値を文字列に変換（比較用）
  const cellString = String(cellValue).toLowerCase();
  const filterString = String(filterValue).toLowerCase();

  // 【オペレータ別処理】: 各比較演算子の実装
  switch (filter.operator) {
    case 'equals':
      return cellString === filterString;
      
    case 'not_equals':
      return cellString !== filterString;
      
    case 'contains':
      return cellString.includes(filterString);
      
    case 'not_contains':
      return !cellString.includes(filterString);
      
    case 'starts_with':
      return cellString.startsWith(filterString);
      
    case 'ends_with':
      return cellString.endsWith(filterString);
      
    case 'greater_than':
      return compareValues(cellValue, filterValue) > 0;
      
    case 'less_than':
      return compareValues(cellValue, filterValue) < 0;
      
    case 'greater_equal':
      return compareValues(cellValue, filterValue) >= 0;
      
    case 'less_equal':
      return compareValues(cellValue, filterValue) <= 0;
      
    case 'is_null':
      return false; // この時点でcellValueはnull出ない
      
    case 'is_not_null':
      return true; // この時点でcellValueはnull出ない
      
    case 'regex':
      try {
        const regex = new RegExp(filterString, 'i'); // 大文字小文字無視
        return regex.test(cellString);
      } catch (error) {
        // 【正規表現エラー】: 無効な正規表現の場合は一致しないと判定
        console.warn(`Invalid regex pattern: ${filterString}`, error);
        return false;
      }
      
    default:
      console.warn(`Unknown filter operator: ${filter.operator}`);
      return true; // 不明なオペレータの場合は通す
  }
}

/**
 * 【機能概要】: 値の比較（型を考慮した比較）
 * 【実装方針】: 数値・日付・文字列の適切な比較
 * 【テスト対応】: 各データ型での比較精度テスト
 * 🟢 信頼性レベル: 型別比較ロジック
 */
function compareValues(cellValue: any, filterValue: any): number {
  // 【数値比較】: 両方が数値として解釈可能な場合
  const cellNum = parseFloat(String(cellValue));
  const filterNum = parseFloat(String(filterValue));
  
  if (!isNaN(cellNum) && !isNaN(filterNum)) {
    return cellNum - filterNum;
  }
  
  // 【日付比較】: 日付として解釈可能な場合
  const cellDate = new Date(String(cellValue));
  const filterDate = new Date(String(filterValue));
  
  if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime())) {
    return cellDate.getTime() - filterDate.getTime();
  }
  
  // 【文字列比較】: デフォルトは辞書順比較
  const cellString = String(cellValue).toLowerCase();
  const filterString = String(filterValue).toLowerCase();
  
  return cellString.localeCompare(filterString);
}

/**
 * 【機能概要】: フィルタルールの検証
 * 【実装方針】: フィルタルールの妥当性チェック
 * 【テスト対応】: 無効なフィルタルールでの検証テスト
 * 🟡 信頼性レベル: 基本的な検証、拡張可能
 */
export function validateFilterRules(filters: CSVFilterRule[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const filter of filters) {
    // 【必須フィールド検証】
    if (!filter.column || !filter.column.trim()) {
      errors.push(`Filter ${filter.id || 'unknown'}: Column name is required`);
    }
    
    if (!filter.operator) {
      errors.push(`Filter ${filter.id || 'unknown'}: Operator is required`);
    }
    
    // 【値必須オペレータの検証】
    const valueRequiredOperators = [
      'equals', 'not_equals', 'contains', 'not_contains',
      'starts_with', 'ends_with', 'greater_than', 'less_than',
      'greater_equal', 'less_equal', 'regex'
    ];
    
    if (valueRequiredOperators.includes(filter.operator) && 
        (!filter.value || (typeof filter.value === 'string' && filter.value.trim() === ''))) {
      errors.push(`Filter ${filter.id || 'unknown'}: Value is required for operator "${filter.operator}"`);
    }
    
    // 【正規表現検証】
    if (filter.operator === 'regex' && filter.value) {
      try {
        new RegExp(String(filter.value));
      } catch (error) {
        errors.push(`Filter ${filter.id || 'unknown'}: Invalid regular expression "${String(filter.value)}"`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 【機能概要】: フィルタ結果の統計情報取得
 * 【実装方針】: フィルタ前後の行数比較
 * 🟡 信頼性レベル: 統計処理、拡張可能
 */
export function getFilterStatistics(
  originalRows: Array<Record<string, any>>,
  filteredRows: Array<Record<string, any>>,
  filters: CSVFilterRule[]
): {
  originalCount: number;
  filteredCount: number;
  reductionPercentage: number;
  activeFiltersCount: number;
} {
  const activeFilters = filters.filter(f => f.enabled);
  const originalCount = originalRows.length;
  const filteredCount = filteredRows.length;
  
  const reductionPercentage = originalCount > 0 
    ? Math.round(((originalCount - filteredCount) / originalCount) * 100)
    : 0;

  return {
    originalCount,
    filteredCount,
    reductionPercentage,
    activeFiltersCount: activeFilters.length,
  };
}