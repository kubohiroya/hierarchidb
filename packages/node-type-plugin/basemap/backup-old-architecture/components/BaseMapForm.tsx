/**
 * @file BaseMapForm.tsx
 * @description BaseMap form component for embedded forms
 */

import React from 'react';
import BaseMapEditor from './BaseMapEditor';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';

export interface BaseMapFormProps {
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onChange: (data: Partial<BaseMapEntity>) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const BaseMapForm: React.FC<BaseMapFormProps> = ({
  entity,
  workingCopy,
  onChange,
  className,
  style,
}) => {
  return (
    <div className={className} style={style} data-testid="basemap-form">
      <BaseMapEditor entity={entity} workingCopy={workingCopy} onSave={onChange} />
    </div>
  );
};

export default BaseMapForm;
