/**
 * BasicInfoFields
 * Shared name/description form fields for Step1 across plugin-loader.
 */

import { Box, FormControl, TextField, Typography } from '@mui/material';
import { useBasicInfoFieldsView } from './useBasicInfoFieldsView.js';

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
  const {
    nameInputId,
    descriptionInputId,
    texts,
    name,
    description,
    nameError,
    handleNameChange,
    handleDescriptionChange,
  } = useBasicInfoFieldsView({
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
  });

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
          onChange={(e) => handleNameChange(e.target.value)}
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
          onChange={(e) => handleDescriptionChange(e.target.value)}
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
