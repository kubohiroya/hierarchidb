/**
 * 【機能概要】: データソース選択ステップコンポーネント
 * 【実装方針】: 最小限のReactコンポーネントとして実装（テスト通過用）
 * 【テスト対応】: TC-101-002のコンポーネント参照テストを通すための最小実装
 * 🟢 信頼性レベル: ステップコンポーネントの基本パターンに基づく
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 【型定義】: DataSourceStepのプロパティ型
 * 🟢 信頼性レベル: 標準的なステップコンポーネントパターン
 */
export interface DataSourceStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

/**
 * 【コンポーネント定義】: データソース選択ステップ
 * 【実装方針】: 現段階では最小限のスタブ実装
 * 【将来拡張】: Refactorフェーズで実際のUIを実装予定
 * 🟢 信頼性レベル: テスト要件を満たす最小実装
 */
export const DataSourceStep: React.FC<DataSourceStepProps> = ({
  data,
  onNext,
  onPrevious,
  errors
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  
  // 【最小実装】: テストを通すためのスタブコンポーネント
  // 【TODO】: Refactorフェーズで実際のファイルアップロードUI等を実装
  return (
    <div>
      {/* 【プレースホルダー】: 実装予定のUI要素 */}
      <h3>{t('dataSource.title', 'Data Source Selection')}</h3>
      <p>{t('dataSource.description', 'Step 2: Select your data source')}</p>
      
      {/* 【エラー表示】: バリデーションエラーの表示領域 */}
      {errors && errors.length > 0 && (
        <div>
          {errors.map((error, index) => (
            <p key={index} style={{ color: 'red' }}>{error}</p>
          ))}
        </div>
      )}
      
      {/* 【ナビゲーションボタン】: ステップ間の移動 */}
      <button onClick={onPrevious}>{t('navigation.previous', 'Previous')}</button>
      <button onClick={() => onNext(data)}>{t('navigation.next', 'Next')}</button>
    </div>
  );
};