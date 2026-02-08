import { useCallback, useEffect, useRef, useId, useState } from 'react';
import type { ChangeEvent, FC } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, TextField, Typography } from '@mui/material';
import { LocalOffer } from '@mui/icons-material';
import { TagChipsInput } from './TagChipsInput.js';
import { useTranslation } from 'react-i18next';

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
  /** Called when a tag chip is clicked */
  onTagClick?: (tag: string) => void;
  /** Show confirmation dialog before removing a tag */
  confirmTagDelete?: boolean;
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
  onTagClick,
  confirmTagDelete = true,
}) => {
  const { t } = useTranslation('plugin-basic-info');
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingTagDelete, setPendingTagDelete] = useState<string | null>(null);
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

  const handleTagClick = useCallback(
    (tag: string) => {
      if (!onTagClick) return;
      onTagClick(tag);
    },
    [onTagClick],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const nextTags = tags.filter((t) => t !== tag);
      emitChange({ tags: nextTags });
    },
    [emitChange, tags],
  );

  const handleTagDeleteRequest = useCallback(
    (tag: string) => {
      if (disabled) return;
      if (!confirmTagDelete) {
        removeTag(tag);
        return;
      }
      setPendingTagDelete(tag);
    },
    [confirmTagDelete, disabled, removeTag],
  );

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
  const nameError = !normalizedName.trim() ? t('name.required', 'Name is required') : null;
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
          ? t('description.create', 'Enter basic information for the new node.')
          : t('description.edit', 'Update the basic information for this node.')}
      </Typography>

      <FormControl fullWidth error={!!mergedNameError}>
        <TextField
          label={String(t('fields.name.label', 'Name'))}
          id={nameInputId}
          name="name"
          value={normalizedName}
          onChange={handleNameChange}
          required
          error={!!mergedNameError}
          helperText={mergedNameError}
          placeholder={String(t('fields.name.placeholder', 'Enter a descriptive name'))}
          variant="outlined"
          inputRef={nameInputRef}
          autoComplete="organization"
          inputProps={{ maxLength: 255, id: nameInputId, name: 'name', autoComplete: 'organization' }}
          slotProps={{
            input: {
              id: nameInputId,
              name: 'name',
              autoComplete: 'organization',
            },
          }}
          disabled={disabled}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label={t('fields.description.label', 'Description')}
          id={descriptionInputId}
          name="description"
          value={normalizedDescription}
          onChange={handleDescriptionChange}
          multiline
          rows={4}
          placeholder={String(t('fields.description.placeholder', 'Enter an optional description'))}
          variant="outlined"
          helperText={String(
            t('fields.description.counter', '{{count}}/1000 characters', {
              count: normalizedDescription.length,
            })
          )}
          autoComplete="off"
          inputProps={{ maxLength: 1000, id: descriptionInputId, name: 'description', autoComplete: 'off' }}
          slotProps={{
            input: {
              id: descriptionInputId,
              name: 'description',
              autoComplete: 'off',
            },
          }}
          disabled={disabled}
        />
      </FormControl>

      <FormControl fullWidth>
        <TagChipsInput
          label={(
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              <LocalOffer fontSize="small" />
              <Box component="span">{t('fields.tags.label', 'Tags')}</Box>
            </Box>
          )}
          value={tags}
          onChange={handleTagsChange}
          onTagClick={handleTagClick}
          onTagDeleteRequest={handleTagDeleteRequest}
          suggestions={tagSuggestions}
          placeholder={String(t('fields.tags.placeholder', 'Enter tag and press Enter'))}
          disabled={disabled}
        />
      </FormControl>

      <Dialog
        open={Boolean(pendingTagDelete)}
        onClose={handleCancelDelete}
        aria-labelledby={`${fieldId}-tag-delete-title`}
      >
        <DialogTitle id={`${fieldId}-tag-delete-title`}>
          {t('tags.remove.title', 'Remove tag?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('tags.remove.body', 'Remove the tag "{{tag}}" from this node?', {
              tag: pendingTagDelete ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            {t('actions.remove', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
