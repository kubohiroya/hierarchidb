/**
 * @file LocationBuildParametersStep.tsx
 * @description Build parameter configuration step for Location dialog.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type React from 'react';
import type { LocationEntity } from '~/common/types/index';
import { useIdeGsmImportOnEntry } from '~/ui/hooks/useIdeGsmImportOnEntry';
import { LocationStyleConfigPanel } from './LocationStyleConfigPanel.js';

interface LocationBuildParametersStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
  disabled?: boolean;
  nodeId?: NodeId;
}

export const LocationBuildParametersStep: React.FC<LocationBuildParametersStepProps> = ({
  draft,
  onUpdate,
  disabled,
  nodeId,
}) => {
  useIdeGsmImportOnEntry({ draft, nodeId, onUpdate });

  return <LocationStyleConfigPanel draft={draft} onUpdate={onUpdate} disabled={disabled} />;
};
