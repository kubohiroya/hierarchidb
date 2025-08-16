/**
 * @file Step2ColumnMapping.tsx
 * @description StyleMap import step 2 - column mapping
 */

import React from 'react';

export interface Step2ColumnMappingProps {
  columns: string[];
  onNext: (keyColumn: string, valueColumn: string) => void;
}

export const Step2ColumnMapping: React.FC<Step2ColumnMappingProps> = ({
  columns: _columns,
  onNext: _onNext,
}) => {
  return (
    <div>
      <h3>Step 2: Column Mapping</h3>
      {/* TODO: Implement column mapping interface */}
      <p>Available columns: {_columns.join(', ')}</p>
    </div>
  );
};

export default Step2ColumnMapping;
