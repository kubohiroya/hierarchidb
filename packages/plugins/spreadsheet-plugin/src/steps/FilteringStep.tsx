import type React from 'react';

export interface FilteringStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const FilteringStep: React.FC<FilteringStepProps> = ({
                                                              data,
                                                              onNext,
                                                              onPrevious,
                                                              errors,
                                                            }) => {
  return (
    <div>
      <h3>フィルタリング</h3>
      <p>Step 3: 行と列のフィルタを設定してください（オプション）</p>
      {errors && errors.length > 0 && (
        <div>
          {errors.map((error, index) => (
            <p key={index} style={{ color: 'red' }}>{error}</p>
          ))}
        </div>
      )}

      <button onClick={onPrevious}>戻る</button>
      <button onClick={() => onNext(data)}>次へ</button>
    </div>
  );
};