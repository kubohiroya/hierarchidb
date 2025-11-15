/**
 * Location Basic Information Step
 */

import type React from 'react';
import { useMemo } from 'react';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { LocationWorkingCopy } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';

interface LocationBasicInfoStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy>) => void;
  mode: 'create' | 'edit';
}

export const LocationBasicInfoStep: React.FC<LocationBasicInfoStepProps> = ({ workingCopy, onUpdate, mode }) => {
  const { translations } = useTranslation();

  const { name, description, tags } = useMemo(() => {
    const draft = workingCopy.draft ?? {};
    return {
      name: draft.name ?? '',
      description: draft.description ?? '',
      tags: workingCopy.tags ?? [],
    };
  }, [workingCopy.draft, workingCopy.tags]);

  const handleChange = (data: BasicInfoData) => {
    onUpdate({
      draft: {
        ...workingCopy.draft,
        name: data.name,
        description: data.description,
      },
      tags: data.tags,
    });
  };

  return (
    <SharedBasicInfoStep
      name={name}
      description={description}
      tags={tags}
      mode={mode}
      onChange={handleChange}
      validate={({ name }) => (name.trim().length ? null : translations.errors.nameRequired)}
      tagSuggestions={translations.basicInfo.tagSuggestions ?? []}
    />
  );
};
