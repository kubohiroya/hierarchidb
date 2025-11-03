/**
 * Basic Information Step Component
 * Common first step for all plugin dialogs
 */

import { TagChipsInput } from '@hierarchidb/ui-plugin-basic-info';
import { LocalOffer } from '@mui/icons-material';
import { Box, FormControl, FormHelperText, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useCallback } from 'react';

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
}

/**
 * Basic Information Step Component
 */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  name,
  description,
  tags = [],
  onChange,
  mode,
  validate,
  tagSuggestions = [],
}) => {
  // Handle name change
  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        name: event.target.value,
        description,
        tags,
      });
    },
    [description, tags, onChange]
  );

  // Handle description change
  const handleDescriptionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({
        name,
        description: event.target.value,
        tags,
      });
    },
    [name, tags, onChange]
  );

  const handleTagsChange = useCallback(
    (nextTags: string[]) => {
      onChange({
        name,
        description,
        tags: nextTags,
      });
    },
    [name, description, onChange]
  );

  // Validation
  const validationError = validate?.({ name, description });
  const nameError = !name.trim() ? 'Name is required' : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="body2" color="text.secondary">
        {mode === 'create'
          ? 'Enter basic information for the new node.'
          : 'Update the basic information for this node.'}
      </Typography>

      <FormControl fullWidth error={!!nameError}>
        <TextField
          label="Name"
          value={name}
          onChange={handleNameChange}
          required
          error={!!nameError}
          helperText={nameError}
          placeholder="Enter a descriptive name"
          variant="outlined"
          inputProps={{
            maxLength: 255,
          }}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label="Description"
          value={description}
          onChange={handleDescriptionChange}
          multiline
          rows={4}
          placeholder="Enter an optional description"
          variant="outlined"
          helperText={`${description.length}/1000 characters`}
          inputProps={{
            maxLength: 1000,
          }}
        />
      </FormControl>

      {/* Tags input */}
      <FormControl fullWidth>
        <TagChipsInput
          label={
            <Box
              style={{
                gap: 1,
                justifyContent: 'start',
                justifyItems: 'start',
                display: 'flex',
                flexDirection: 'row',
              }}
            >
              <LocalOffer />
              <Box>Tags</Box>
            </Box>
          }
          value={tags}
          onChange={handleTagsChange}
          suggestions={tagSuggestions}
          placeholder="Enter tag and press Enter"
        />
      </FormControl>

      {validationError && <FormHelperText error>{validationError}</FormHelperText>}
    </Box>
  );
};
