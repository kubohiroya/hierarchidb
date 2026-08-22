import { useCallback, useId, useMemo } from 'react';
import type { BasicInfoFieldsProps } from './BasicInfoFields.js';

export interface UseBasicInfoFieldsViewResult {
  nameInputId: string;
  descriptionInputId: string;
  texts: {
    title: string;
    subtitle: string;
    nameLabel: string;
    nameHelperText: string;
    nameRequiredText: string;
    namePlaceholder: string;
    descriptionLabel: string;
    descriptionHelperText: string;
    descriptionPlaceholder: string;
  };
  name: string;
  description: string;
  nameError: boolean;
  handleNameChange: (nextValue: string) => void;
  handleDescriptionChange: (nextValue: string) => void;
}

export function useBasicInfoFieldsView({
  value,
  onChange,
  title,
  subtitle,
  nameLabel,
  nameHelperText,
  nameRequiredText,
  namePlaceholder,
  descriptionLabel,
  descriptionHelperText,
  descriptionPlaceholder,
}: Pick<
  BasicInfoFieldsProps,
  | 'value'
  | 'onChange'
  | 'title'
  | 'subtitle'
  | 'nameLabel'
  | 'nameHelperText'
  | 'nameRequiredText'
  | 'namePlaceholder'
  | 'descriptionLabel'
  | 'descriptionHelperText'
  | 'descriptionPlaceholder'
>): UseBasicInfoFieldsViewResult {
  const controlId = useId();
  const nameInputId = `${controlId}-name`;
  const descriptionInputId = `${controlId}-description`;

  const texts = useMemo(
    () => ({
      title: title ?? 'Basic Information',
      subtitle: subtitle ?? 'Enter a name and optional description.',
      nameLabel: nameLabel ?? 'Name',
      nameHelperText: nameHelperText ?? 'Enter a descriptive name',
      nameRequiredText: nameRequiredText ?? 'Name is required',
      namePlaceholder: namePlaceholder ?? 'Enter name',
      descriptionLabel: descriptionLabel ?? 'Description',
      descriptionHelperText: descriptionHelperText ?? 'Describe the purpose or contents (optional)',
      descriptionPlaceholder: descriptionPlaceholder ?? 'Enter description (optional)',
    }),
    [
      title,
      subtitle,
      nameLabel,
      nameHelperText,
      nameRequiredText,
      namePlaceholder,
      descriptionLabel,
      descriptionHelperText,
      descriptionPlaceholder,
    ]
  );

  const name = value.name ?? '';
  const description = value.description ?? '';
  const nameError = !name.trim();

  const handleNameChange = useCallback(
    (nextValue: string) => {
      onChange({ name: nextValue });
    },
    [onChange]
  );

  const handleDescriptionChange = useCallback(
    (nextValue: string) => {
      onChange({ description: nextValue });
    },
    [onChange]
  );

  return {
    nameInputId,
    descriptionInputId,
    texts,
    name,
    description,
    nameError,
    handleNameChange,
    handleDescriptionChange,
  };
}
