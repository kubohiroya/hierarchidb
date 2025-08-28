/**
 * @file StyleMapStep6.tsx
 * @description Step 6 wrapper component for StyleMap table preview
 * 【機能概要】: スタイルマッピングのプレビューステップ
 * 【実装方針】: 設定に基づいた色付きテーブル表示
 * 🟢 信頼性レベル: データビジュアライゼーション対応
 */

import React, { useCallback, useMemo } from 'react';
import { Box, Alert, AlertTitle } from '@mui/material';
import { StyleMapTablePreview } from '../../components/step6/StyleMapTablePreview';
import type { StyleMapConfig } from '../../types/styleMapTypes';
import { StyleMapConfigDefault } from '../../types/styleMapTypes';

/**
 * 【型定義】: Step6のプロパティ
 */
export interface StyleMapStep6Props {
  data: any;
  onChange: (data: any) => void;
  onValidate?: (isValid: boolean) => void;
  // CSVデータ関連
  csvData?: Array<Record<string, any>>;
  columns?: string[];
}

/**
 * 【機能概要】: StyleMap Step6コンポーネント
 * 【実装方針】: StyleMapTablePreviewをラップしてプレビュー機能を提供
 * 【テスト対応】: 大容量データでのプレビュー動作確認
 * 🟢 信頼性レベル: パフォーマンス最適化済み
 */
export const StyleMapStep6: React.FC<StyleMapStep6Props> = ({
  data,
  onChange,
  onValidate,
  csvData = [],
  // columns = [],
}) => {
  // 【設定の取得】
  const config: StyleMapConfig = data?.styleMapConfig || StyleMapConfigDefault;
  const selectedKeyColumn = data?.selectedKeyColumn;
  const selectedValueColumn = data?.selectedValueColumn;

  // 【プレビューデータの準備】
  const previewData = useMemo(() => {
    // 最大1000行までプレビュー
    return csvData.slice(0, 1000);
  }, [csvData]);

  // 【列選択ハンドラ】: プレビュー画面での列選択変更
  const handleColumnSelect = useCallback(
    (columnName: string, type: 'key' | 'value') => {
      const updatedData = {
        ...data,
        [type === 'key' ? 'selectedKeyColumn' : 'selectedValueColumn']: columnName,
      };

      // 設定にも反映
      if (data?.styleMapConfig) {
        updatedData.styleMapConfig = {
          ...data.styleMapConfig,
          [type === 'key' ? 'keyColumn' : 'valueColumn']: columnName,
        };
      }

      onChange(updatedData);
    },
    [data, onChange]
  );

  // 【バリデーション状態の更新】
  React.useEffect(() => {
    if (onValidate) {
      // Step6は確認ステップなので常に有効
      onValidate(true);
    }
  }, [onValidate]);

  // 【エラー表示】: 設定が不完全な場合
  if (!config.targetProperty || !selectedValueColumn) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <AlertTitle>Configuration Required</AlertTitle>
          Please complete Step 5 configuration before viewing the preview.
          <ul>
            {!config.targetProperty && <li>Select a MapLibre style property</li>}
            {!selectedValueColumn && <li>Select a value column for mapping</li>}
          </ul>
        </Alert>
      </Box>
    );
  }

  // 【データ不足の警告】
  if (csvData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>No Data Available</AlertTitle>
          No CSV data is available for preview. Please ensure data has been loaded in previous
          steps.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <StyleMapTablePreview
        data={previewData}
        selectedKeyColumn={selectedKeyColumn}
        selectedValueColumn={selectedValueColumn}
        config={config}
        onColumnSelect={handleColumnSelect}
        maxRows={1000}
        enableVirtualization={previewData.length > 100}
      />

      {/* パフォーマンス警告 */}
      {csvData.length > 1000 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Showing preview of first 1,000 rows. Full dataset contains{' '}
          {csvData.length.toLocaleString()} rows.
        </Alert>
      )}
    </Box>
  );
};

/**
 * 【エクスポート】: Step定義オブジェクト
 */
export const StyleMapStep6Definition = {
  stepNumber: 6,
  title: 'Preview with Style Mapping',
  component: StyleMapStep6,
  validation: {
    validate: async (_data: any) => {
      // プレビューステップは常に有効
      // ユーザーが最終確認できればOK
      return { isValid: true, errors: [] };
    },
  },
};
