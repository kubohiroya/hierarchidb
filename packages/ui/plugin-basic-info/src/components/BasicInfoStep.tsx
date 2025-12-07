import { useCallback, useEffect, useRef, useId } from 'react';
import type { ChangeEvent, FC } from 'react';
import { Box, FormControl, TextField, Typography } from '@mui/material';
import { LocalOffer } from '@mui/icons-material';
import { TagChipsInput } from './TagChipsInput.js';

export interface BasicInfoData {
  name: string;
  description: string;
  tags?: string[];
}

export interface BasicInfoStepProps {
  /** Current name value */
  name: string;
  /** Current description value */
  description: string;
  /** Current tags */
  tags?: string[];
  /** Change handler */
  onChange: (data: BasicInfoData) => void;
  /** Dialog mode */
  mode: 'create' | 'edit';
  /** Optional custom validation */
  validate?: (data: BasicInfoData) => string | null;
  /** Optional tag suggestions */
  tagSuggestions?: string[];
  /** Disable editing */
  disabled?: boolean;
}

/**
 * Shared Basic Information step component for dialogs.
 * Provides name/description/tag inputs and handles validation focus behavior.
 */
export const BasicInfoStep: FC<BasicInfoStepProps> = ({
  name,
  description,
  tags = [],
  onChange,
  mode,
  validate,
  tagSuggestions = [],
  disabled = false,
}) => {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();
  const nameInputId = `${fieldId}-name`;
  const descriptionInputId = `${fieldId}-description`;

  const emitChange = useCallback(
    (updates: Partial<BasicInfoData>) => {
      onChange({
        name,
        description,
        tags,
        ...updates,
      });
    },
    [description, name, onChange, tags],
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      emitChange({ name: event.target.value });
    },
    [emitChange],
  );

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      emitChange({ description: event.target.value });
    },
    [emitChange],
  );

  const handleTagsChange = useCallback(
    (nextTags: string[]) => {
      emitChange({ tags: nextTags });
    },
    [emitChange],
  );

  const normalizedName = typeof name === 'string' ? name : '';
  const normalizedDescription = typeof description === 'string' ? description : '';
  const validationError = validate?.({ name: normalizedName, description: normalizedDescription, tags });
  const nameError = !normalizedName.trim() ? 'Name is required' : null;
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {mode === 'create'
          ? 'Enter basic information for the new node.'
          : 'Update the basic information for this node.'}
      </Typography>

      <FormControl fullWidth error={!!mergedNameError}>
        <TextField
          label="Name"
          id={nameInputId}
          name="name"
          value={normalizedName}
          onChange={handleNameChange}
          required
          error={!!mergedNameError}
          helperText={mergedNameError}
          placeholder="Enter a descriptive name"
          variant="outlined"
          inputRef={nameInputRef}
          inputProps={{ maxLength: 255, id: nameInputId, name: 'name' }}
          disabled={disabled}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label="Description"
          id={descriptionInputId}
          name="description"
          value={normalizedDescription}
          onChange={handleDescriptionChange}
          multiline
          rows={4}
          placeholder="Enter an optional description"
          variant="outlined"
          helperText={`${normalizedDescription.length}/1000 characters`}
          inputProps={{ maxLength: 1000, id: descriptionInputId, name: 'description' }}
          disabled={disabled}
        />
      </FormControl>

      <FormControl fullWidth>
        <TagChipsInput
          label={(
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              <LocalOffer fontSize="small" />
              <Box component="span">Tags</Box>
            </Box>
          )}
          value={tags}
          onChange={handleTagsChange}
          suggestions={tagSuggestions}
          placeholder="Enter tag and press Enter"
          disabled={disabled}
        />
      </FormControl>
    </Box>
  );
};
