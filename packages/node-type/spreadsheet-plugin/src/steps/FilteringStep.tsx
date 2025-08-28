/**
 * 【機能概要】: フィルタリングステップコンポーネント
 * 【実装方針】: 最小限のReactコンポーネントとして実装（テスト通過用）
 * 【テスト対応】: TC-101-002のコンポーネント参照テストを通すための最小実装
 * 🟢 信頼性レベル: ステップコンポーネントの基本パターンに基づく
 */

import React from 'react';

/**
 * 【型定義】: FilteringStepのプロパティ型
 * 🟢 信頼性レベル: 標準的なステップコンポーネントパターン
 */
export interface FilteringStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

/**
 * 【コンポーネント定義】: フィルタリングステップ
 * 【実装方針】: 現段階では最小限のスタブ実装
 * 【将来拡張】: Refactorフェーズで実際のフィルタUIを実装予定
 * 🟢 信頼性レベル: テスト要件を満たす最小実装
 */
export const FilteringStep: React.FC<FilteringStepProps> = ({
  data,
  onNext,
  onPrevious,
  errors
}) => {
  // 【最小実装】: テストを通すためのスタブコンポーネント
  // 【TODO】: Refactorフェーズで実際のフィルタ設定UIを実装
  return (
    <div>
      {/* 【プレースホルダー】: 実装予定のUI要素 */}
      <h3>フィルタリング</h3>
      <p>Step 3: 行と列のフィルタを設定してください（オプション）</p>
      
      {/* 【エラー表示】: バリデーションエラーの表示領域 */}
      {errors && errors.length > 0 && (
        <div>
          {errors.map((error, index) => (
            <p key={index} style={{ color: 'red' }}>{error}</p>
          ))}
        </div>
      )}
      
      {/* 【ナビゲーションボタン】: ステップ間の移動 */}
      <button onClick={onPrevious}>戻る</button>
      <button onClick={() => onNext(data)}>次へ</button>
    </div>
  );
};