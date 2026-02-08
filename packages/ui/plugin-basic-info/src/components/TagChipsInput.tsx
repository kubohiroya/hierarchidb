import { type KeyboardEvent, useMemo, useState, useId, type ReactNode } from 'react'
import { Box, Chip, Stack, TextField, Typography, useTheme } from '@mui/material';

export interface TagChipsInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  onTagClick?: (tag: string) => void;
  onTagDeleteRequest?: (tag: string) => void;
  placeholder?: string;
  label?: ReactNode;
  maxTags?: number;
  disabled?: boolean;
  helperText?: string;
  error?: boolean;
  required?: boolean;
  suggestions?: string[];
}

export const TagChipsInput: React.FC<TagChipsInputProps> = ({
  value = [],
  onChange,
  onTagClick,
  onTagDeleteRequest,
  placeholder = 'Enter tag and press Enter',
  label = 'Tags',
  maxTags = 20,
  disabled = false,
  helperText,
  error = false,
  required = false,
  suggestions = [],
}) => {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const controlId = useId();
  const inputId = `${controlId}-tags`;
  const labelId = `${controlId}-label`;

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || value.includes(t) || value.length >= maxTags) return;
    onChange?.([...value, t]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange?.(value.filter((v) => v !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(input);
    }
  };

  const availableSuggestions = useMemo(() => suggestions.filter((s) => s && !value.includes(s)), [suggestions, value]);

  return (
    <Box data-ui-core="TagChipsInput" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {label && (
        <Typography id={labelId} variant="subtitle2">
          {label}{required ? ' *' : ''}
        </Typography>
      )}

      {/* Selected tags */}
      {value && value.length > 0 && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.5 }}>
        {value.map((t) => (
          <Chip
            key={t}
            label={t}
            color="primary" // default to primary for visibility in dark mode
            clickable={Boolean(onTagClick) && !disabled}
            onClick={disabled ? undefined : onTagClick ? () => onTagClick(t) : undefined}
            onDelete={
              disabled
                ? undefined
                : (event) => {
                    event.stopPropagation();
                    if (onTagDeleteRequest) {
                      onTagDeleteRequest(t);
                      return;
                    }
                    removeTag(t);
                  }
            }
            size="small"
          />
        ))}
      </Stack>
      }

      {/* Input */}
      <TextField
        id={inputId}
        name="tags"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || value.length >= maxTags}
        required={required}
        error={error}
        helperText={helperText}
        variant="outlined"
        size="small"
        inputProps={{ 'aria-labelledby': labelId, id: inputId, name: 'tags' }}
        sx={{
          maxWidth: 480,
          // Let MUI theme control colors; ensure contrast in dark mode
          bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'background.paper',
        }}
      />

      {/* Suggestions */}
      {availableSuggestions.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-label="tag-suggestions">
          {availableSuggestions.slice(0, 10).map((s) => (
            <Chip
              key={s}
              label={`+ ${s}`}
              variant="outlined"
              color="primary"
              size="small"
              onClick={() => addTag(s)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};
