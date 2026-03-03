import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { BasicInfoData, BasicInfoStepProps } from './BasicInfoStep.js';

export interface UseBasicInfoStepViewParams {
  name: BasicInfoStepProps['name'];
  description: BasicInfoStepProps['description'];
  tags: string[];
  onChange: BasicInfoStepProps['onChange'];
  mode: BasicInfoStepProps['mode'];
  validate: BasicInfoStepProps['validate'];
  disabled: boolean;
  onTagClick: BasicInfoStepProps['onTagClick'];
  confirmTagDelete: boolean;
  requiredNameMessage: string;
}

export interface UseBasicInfoStepViewResult {
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  fieldId: string;
  nameInputId: string;
  descriptionInputId: string;
  pendingTagDelete: string | null;
  normalizedName: string;
  normalizedDescription: string;
  mergedNameError: string | null;
  handleNameChange: (value: string) => void;
  handleDescriptionChange: (value: string) => void;
  handleTagsChange: (nextTags: string[]) => void;
  handleTagClick: (tag: string) => void;
  handleTagDeleteRequest: (tag: string) => void;
  handleConfirmDelete: () => void;
  handleCancelDelete: () => void;
}

export function useBasicInfoStepView({
  name,
  description,
  tags,
  onChange,
  mode,
  validate,
  disabled,
  onTagClick,
  confirmTagDelete,
  requiredNameMessage,
}: UseBasicInfoStepViewParams): UseBasicInfoStepViewResult {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingTagDelete, setPendingTagDelete] = useState<string | null>(null);
  const fieldId = useId();
  const nameInputId = `${fieldId}-name`;
  const descriptionInputId = `${fieldId}-description`;

  const emitChange = useCallback((updates: Partial<BasicInfoData>) => {
    onChange({
      name,
      description,
      tags,
      ...updates,
    });
  }, [description, name, onChange, tags]);

  const removeTag = useCallback((tag: string) => {
    const nextTags = tags.filter((currentTag) => currentTag !== tag);
    emitChange({ tags: nextTags });
  }, [emitChange, tags]);

  const handleNameChange = useCallback((value: string) => {
    emitChange({ name: value });
  }, [emitChange]);

  const handleDescriptionChange = useCallback((value: string) => {
    emitChange({ description: value });
  }, [emitChange]);

  const handleTagsChange = useCallback((nextTags: string[]) => {
    emitChange({ tags: nextTags });
  }, [emitChange]);

  const handleTagClick = useCallback((tag: string) => {
    if (!onTagClick) return;
    onTagClick(tag);
  }, [onTagClick]);

  const handleTagDeleteRequest = useCallback((tag: string) => {
    if (disabled) return;
    if (!confirmTagDelete) {
      removeTag(tag);
      return;
    }
    setPendingTagDelete(tag);
  }, [confirmTagDelete, disabled, removeTag]);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingTagDelete) return;
    removeTag(pendingTagDelete);
    setPendingTagDelete(null);
  }, [pendingTagDelete, removeTag]);

  const handleCancelDelete = useCallback(() => {
    setPendingTagDelete(null);
  }, []);

  const normalizedName = typeof name === 'string' ? name : '';
  const normalizedDescription = typeof description === 'string' ? description : '';
  const validationError = validate?.({ name: normalizedName, description: normalizedDescription, tags });
  const nameError = !normalizedName.trim() ? requiredNameMessage : null;
  const mergedNameError = validationError ?? nameError;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (mode !== 'create') return undefined;

    const input = nameInputRef.current;
    if (!input) return undefined;

    const timer = window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [mode]);

  return {
    nameInputRef,
    fieldId,
    nameInputId,
    descriptionInputId,
    pendingTagDelete,
    normalizedName,
    normalizedDescription,
    mergedNameError,
    handleNameChange,
    handleDescriptionChange,
    handleTagsChange,
    handleTagClick,
    handleTagDeleteRequest,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
