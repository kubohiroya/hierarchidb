/**
 * BasicInfoFields
 * Shared name/description form fields for Step1 across plugin-loader.
 */

import { useMemo, useId } from 'react';
import { Box, FormControl, TextField, Typography } from '@mui/material';

export interface BasicInfoValue {
  name?: string;
  description?: string;
}

export interface BasicInfoFieldsProps {
  value: BasicInfoValue;
  onChange: (updates: Partial<BasicInfoValue>) => void;
  disabled?: boolean;
  nameMaxLength?: number;
  descriptionMaxLength?: number;
  // Optional text overrides (use plugin-specific i18n if desired)
  nameLabel?: string;
  nameHelperText?: string;
  nameRequiredText?: string;
  namePlaceholder?: string;
  descriptionLabel?: string;
  descriptionHelperText?: string;
  descriptionPlaceholder?: string;
  // Optional header/intro for sectioned layouts
  title?: string;
  subtitle?: string;
}

export const BasicInfoFields: React.FC<BasicInfoFieldsProps> = ({
                                                                  value,
                                                                  onChange,
                                                                  disabled = false,
                                                                  nameMaxLength = 100,
                                                                  descriptionMaxLength = 500,
                                                                  // text overrides (fallback to _obsolate_common i18n > English literals)
                                                                  nameLabel,
                                                                  nameHelperText,
                                                                  nameRequiredText,
                                                                  namePlaceholder,
                                                                  descriptionLabel,
                                                                  descriptionHelperText,
                                                                  descriptionPlaceholder,
                                                                  title,
                                                                  subtitle,
}) => {
  const controlId = useId();
  const nameInputId = `${controlId}-name`;
  const descriptionInputId = `${controlId}-description`;
  const texts = useMemo(() => ({
    title: title ?? 'Basic Information',
    subtitle: subtitle ?? 'Enter a name and optional description.',
    nameLabel: nameLabel ?? 'Name',
    nameHelperText: nameHelperText ?? 'Enter a descriptive name',
    nameRequiredText: nameRequiredText ?? 'Name is required',
    namePlaceholder: namePlaceholder ?? 'Enter name',
    descriptionLabel: descriptionLabel ?? 'Description',
    descriptionHelperText: descriptionHelperText ?? 'Describe the purpose or contents (optional)',
    descriptionPlaceholder: descriptionPlaceholder ?? 'Enter description (optional)',
  }), [
    title,
    subtitle,
    nameLabel,
    nameHelperText,
    nameRequiredText,
    namePlaceholder,
    descriptionLabel,
    descriptionHelperText,
    descriptionPlaceholder,
  ]);

  const name = value.name ?? '';
  const description = value.description ?? '';
  const nameError = !name.trim();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {(title || subtitle) && (
        <Box>
          {title && (
            <Typography variant="h6" gutterBottom>
              {texts.title}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {texts.subtitle}
            </Typography>
          )}
        </Box>
      )}

      <FormControl fullWidth>
        <TextField
          label={texts.nameLabel}
          id={nameInputId}
          name="name"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
          fullWidth
          disabled={disabled}
          error={nameError}
          helperText={nameError ? texts.nameRequiredText : texts.nameHelperText}
          inputProps={{ maxLength: nameMaxLength, id: nameInputId, name: 'name' }}
          placeholder={texts.namePlaceholder}
        />
      </FormControl>

      <FormControl fullWidth>
        <TextField
          label={texts.descriptionLabel}
          id={descriptionInputId}
          name="description"
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          multiline
          rows={3}
          fullWidth
          disabled={disabled}
          helperText={texts.descriptionHelperText}
          inputProps={{ maxLength: descriptionMaxLength, id: descriptionInputId, name: 'description' }}
          placeholder={texts.descriptionPlaceholder}
        />
      </FormControl>
    </Box>
  );
};
