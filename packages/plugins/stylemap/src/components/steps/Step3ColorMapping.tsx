/**
 * @file Step3ColorMapping.tsx
 * @description StyleMap import step 3 - color mapping
 */

import React from 'react';

export interface Step3ColorMappingProps {
  onNext: (colorConfig: any) => void;
}

export const Step3ColorMapping: React.FC<Step3ColorMappingProps> = ({ onNext: _onNext }) => {
  return (
    <div>
      <h3>Step 3: Color Mapping</h3>
      {/* TODO: Implement color mapping interface */}
    </div>
  );
};

export default Step3ColorMapping;
