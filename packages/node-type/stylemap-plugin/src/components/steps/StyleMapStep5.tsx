/**
 * @file StyleMapStep5.tsx
 * @description Step 5 wrapper component for StyleMap configuration
 * 【機能概要】: スタイルマッピング設定ステップ
 * 【実装方針】: Spreadsheetプラグインの拡張ステップとして動作
 * 🟢 信頼性レベル: フォーム統合済み
 */

import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { StyleMapConfiguration } from '../../components/step5/StyleMapConfiguration';
import type { StyleMapConfig } from '../../types/styleMapTypes';
import { StyleMapConfigDefault } from '../../types/styleMapTypes';

/**
 * 【型定義】: Step5のプロパティ
 * Spreadsheetプラグインから渡される標準的なステッププロパティ
 */
export interface StyleMapStep5Props {
  data: any;
  onChange: (data: any) => void;
  onValidate?: (isValid: boolean) => void;
  // CSVデータ関連（spreadsheetから渡される）
  csvData?: Array<Record<string, any>>;
  columns?: string[];
}

/**
 * 【機能概要】: StyleMap Step5コンポーネント
 * 【実装方針】: StyleMapConfigurationをラップしてステップ形式で提供
 * 【テスト対応】: データ変更とバリデーションの連携
 * 🟢 信頼性レベル: Spreadsheetとの統合対応
 */
export const StyleMapStep5: React.FC<StyleMapStep5Props> = ({
  data,
  onChange,
  onValidate,
  csvData = [],
  columns = [],
}) => {
  // 【設定の初期化】
  const currentConfig: StyleMapConfig = data?.styleMapConfig || StyleMapConfigDefault;

  // 【数値列の抽出】: 値列の候補として数値列を検出
  // const numericColumns = React.useMemo(() => {
  //   if (csvData.length === 0) return [];
  //
  //   return columns.filter(col => {
  //     // サンプルデータから数値列を判定
  //     const sampleValues = csvData.slice(0, 10).map(row => row[col]);
  //     return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  //   });
  // }, [csvData, columns]);

  // 【サンプル値の取得】: プレビュー用の数値データ
  const sampleValues = React.useMemo(() => {
    const valueColumn = data?.selectedValueColumn;
    if (!valueColumn || csvData.length === 0) return [];

    return csvData
      .map((row) => row[valueColumn])
      .filter((val) => typeof val === 'number' && !isNaN(val))
      .slice(0, 100); // 最初の100件をサンプルとして使用
  }, [csvData, data?.selectedValueColumn]);

  // 【設定変更ハンドラ】
  const handleConfigChange = useCallback(
    (newConfig: StyleMapConfig) => {
      const updatedData = {
        ...data,
        styleMapConfig: newConfig,
      };
      onChange(updatedData);

      // バリデーション: targetPropertyが選択されていることを確認
      if (onValidate) {
        const isValid = !!newConfig.targetProperty;
        onValidate(isValid);
      }
    },
    [data, onChange, onValidate]
  );

  // 【列選択ハンドラ】
  const handleColumnSelect = useCallback(
    (column: string, type: 'key' | 'value') => {
      const updatedData = {
        ...data,
        [type === 'key' ? 'selectedKeyColumn' : 'selectedValueColumn']: column,
        styleMapConfig: {
          ...currentConfig,
          [type === 'key' ? 'keyColumn' : 'valueColumn']: column,
        },
      };
      onChange(updatedData);

      // バリデーション更新
      if (onValidate) {
        const hasRequiredFields =
          !!updatedData.styleMapConfig.targetProperty && !!updatedData.selectedValueColumn;
        onValidate(hasRequiredFields);
      }
    },
    [data, currentConfig, onChange, onValidate]
  );

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <StyleMapConfiguration
        config={currentConfig}
        onChange={handleConfigChange}
        values={sampleValues}
        columns={columns}
        selectedKeyColumn={data?.selectedKeyColumn}
        selectedValueColumn={data?.selectedValueColumn}
        onColumnSelect={handleColumnSelect}
        csvData={csvData}
      />
    </Box>
  );
};

/**
 * 【エクスポート】: Step定義オブジェクト
 * Spreadsheetプラグインの拡張ステップとして登録される
 */
export const StyleMapStep5Definition = {
  stepNumber: 5,
  title: 'Style Mapping Configuration',
  component: StyleMapStep5,
  validation: {
    validate: async (data: any) => {
      const config = data?.styleMapConfig;

      // 必須フィールドの確認
      if (!config?.targetProperty) {
        return {
          isValid: false,
          errors: ['Please select a MapLibre style property to map'],
        };
      }

      if (!data?.selectedValueColumn) {
        return {
          isValid: false,
          errors: ['Please select a value column for mapping'],
        };
      }

      // 数値範囲の妥当性確認
      if (config.mapping.min >= config.mapping.max) {
        return {
          isValid: false,
          errors: ['Maximum value must be greater than minimum value'],
        };
      }

      return { isValid: true, errors: [] };
    },
  },
};
