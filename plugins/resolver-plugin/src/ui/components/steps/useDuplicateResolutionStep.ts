import { useEffect, useState } from 'react';
import type { DuplicateResolutionStrategy, ResolverUpdaterPayload } from '../../../common/types/index.js';

interface UseDuplicateResolutionStepProps {
  data: Partial<ResolverUpdaterPayload>;
  onUpdate: (updates: Partial<ResolverUpdaterPayload>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export function useDuplicateResolutionStep({
  data,
  onUpdate,
  onValidationChange,
}: UseDuplicateResolutionStepProps) {
  const draftData = data.draftData ?? {};
  const [strategy, setStrategy] = useState<DuplicateResolutionStrategy['strategy']>(
    draftData.duplicateResolution?.strategy || 'ignore',
  );
  const [customFunction, setCustomFunction] = useState<string>(
    draftData.duplicateResolution?.customFunction || '',
  );
  const [mergeProperties, setMergeProperties] = useState<string>(
    draftData.duplicateResolution?.mergeProperties?.join(', ') || '',
  );
  const [enableDuplicateDetection, setEnableDuplicateDetection] = useState(true);
  const [customFunctionError, setCustomFunctionError] = useState<string>('');

  useEffect(() => {
    const duplicateResolution: DuplicateResolutionStrategy = {
      strategy,
      customFunction: strategy === 'custom' ? customFunction : undefined,
      mergeProperties: strategy === 'merge' && mergeProperties
        ? mergeProperties.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        : undefined,
    };

    onUpdate({ draftData: { duplicateResolution } });
  }, [strategy, customFunction, mergeProperties, onUpdate]);

  useEffect(() => {
    let isValid = true;

    if (strategy === 'custom') {
      if (!customFunction.trim()) {
        isValid = false;
        setCustomFunctionError('Custom function is required');
      } else {
        new Function(customFunction);
        setCustomFunctionError('');
      }
    } else {
      setCustomFunctionError('');
    }

    onValidationChange(isValid);
  }, [strategy, customFunction, onValidationChange]);

  return {
    customFunction,
    customFunctionError,
    enableDuplicateDetection,
    mergeProperties,
    setCustomFunction,
    setEnableDuplicateDetection,
    setMergeProperties,
    setStrategy,
    strategy,
  };
}
