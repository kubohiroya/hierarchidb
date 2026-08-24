import { useTranslation } from '@hierarchidb/ui-i18n';
import { LocalOffer } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  TextField,
  Typography,
} from '@mui/material';
import type { FC } from 'react';
import { TagChipsInput } from './TagChipsInput.js';
import { useBasicInfoStepView } from './useBasicInfoStepView.js';

export interface BasicInfoData {
  name: string;
  description: string;
  tags?: string[];
}

export type BasicInfoFieldId = 'name' | 'description' | 'tags';

export type BasicInfoFieldEditLock = {
  readonly locked: boolean;
  readonly reason?: string;
};

export type BasicInfoFieldEditLocks = Partial<Record<BasicInfoFieldId, BasicInfoFieldEditLock>>;

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
  /** Field-level edit locks resolved from the canonical build session state. */
  fieldEditLocks?: BasicInfoFieldEditLocks;
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
  fieldEditLocks,
  onTagClick,
  confirmTagDelete = true,
}) => {
  const { t } = useTranslation('plugin-basic-info');
  const {
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
  } = useBasicInfoStepView({
    name,
    description,
    tags,
    onChange,
    mode,
    validate,
    disabled,
    onTagClick,
    confirmTagDelete,
    requiredNameMessage: String(t('name.required', 'Name is required')),
  });
  const nameLock = fieldEditLocks?.name;
  const descriptionLock = fieldEditLocks?.description;
  const tagsLock = fieldEditLocks?.tags;
  const isNameDisabled = disabled || Boolean(nameLock?.locked);
  const isDescriptionDisabled = disabled || Boolean(descriptionLock?.locked);
  const isTagsDisabled = disabled || Boolean(tagsLock?.locked);

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
          onChange={(event) => handleNameChange(event.target.value)}
          required
          error={!!mergedNameError}
          helperText={nameLock?.locked ? nameLock.reason : mergedNameError}
          placeholder={String(t('fields.name.placeholder', 'Enter a descriptive name'))}
          variant="outlined"
          inputRef={nameInputRef}
          autoComplete="organization"
          inputProps={{
            maxLength: 255,
            id: nameInputId,
            name: 'name',
            autoComplete: 'organization',
          }}
          slotProps={{
            input: {
              id: nameInputId,
              name: 'name',
              autoComplete: 'organization',
            },
          }}
          disabled={isNameDisabled}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label={t('fields.description.label', 'Description')}
          id={descriptionInputId}
          name="description"
          value={normalizedDescription}
          onChange={(event) => handleDescriptionChange(event.target.value)}
          multiline
          rows={4}
          placeholder={String(t('fields.description.placeholder', 'Enter an optional description'))}
          variant="outlined"
          helperText={
            descriptionLock?.locked
              ? descriptionLock.reason
              : String(
                  t('fields.description.counter', '{{count}}/1000 characters', {
                    count: normalizedDescription.length,
                  })
                )
          }
          autoComplete="off"
          inputProps={{
            maxLength: 1000,
            id: descriptionInputId,
            name: 'description',
            autoComplete: 'off',
          }}
          slotProps={{
            input: {
              id: descriptionInputId,
              name: 'description',
              autoComplete: 'off',
            },
          }}
          disabled={isDescriptionDisabled}
        />
      </FormControl>

      <FormControl fullWidth>
        <TagChipsInput
          label={
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
              <LocalOffer fontSize="small" />
              <Box component="span">{t('fields.tags.label', 'Tags')}</Box>
            </Box>
          }
          value={tags}
          onChange={handleTagsChange}
          onTagClick={handleTagClick}
          onTagDeleteRequest={handleTagDeleteRequest}
          suggestions={tagSuggestions}
          placeholder={String(t('fields.tags.placeholder', 'Enter tag and press Enter'))}
          disabled={isTagsDisabled}
          helperText={tagsLock?.locked ? tagsLock.reason : undefined}
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
          <Button onClick={handleCancelDelete}>{t('actions.cancel', 'Cancel')}</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            {t('actions.remove', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
