import type { TagId } from '@hierarchidb/tag-api';
import { Add as AddIcon, Delete as DeleteIcon, LocalOffer as TagIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useTagInput } from './useTagInput.js';

export interface TagInputProps {
  value: TagId[];
  onChange: (tags: TagId[]) => void;
  placeholder?: string;
  maxTags?: number;
  allowCreate?: boolean;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  error?: boolean;
  required?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({
  value = [],
  onChange,
  placeholder = 'タグを入力または選択...',
  maxTags = 10,
  allowCreate = true,
  disabled = false,
  label = 'タグ',
  helperText,
  error = false,
  required = false,
}) => {
  const {
    createDialogOpen,
    handleCreateTag,
    handleKeyDown,
    handleTagAdd,
    handleTagRemove,
    inputValue,
    loading,
    newTagName,
    selectedTags,
    setCreateDialogOpen,
    setInputValue,
    setNewTagName,
    shouldOfferCreate,
    suggestions,
  } = useTagInput({
    value,
    onChange,
    maxTags,
    allowCreate,
  });

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
        {required && <span style={{ color: 'error.main' }}> *</span>}
      </Typography>

      {/*
       */}
      {selectedTags.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {selectedTags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                style={{ backgroundColor: tag.color, color: 'white' }}
                onDelete={disabled ? undefined : () => handleTagRemove(tag.id)}
                deleteIcon={<DeleteIcon />}
                disabled={disabled}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/*
       */}
      <Autocomplete
        multiple={false}
        options={suggestions}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
        inputValue={inputValue}
        onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
        onChange={(_, selectedOption) => {
          if (selectedOption && typeof selectedOption !== 'string') {
            handleTagAdd(selectedOption);
          }
        }}
        loading={loading}
        disabled={disabled || value.length >= maxTags}
        freeSolo={allowCreate}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={value.length >= maxTags ? `最大${maxTags}個まで` : placeholder}
            error={error}
            helperText={
              helperText || (value.length >= maxTags ? `最大${maxTags}個まで選択可能` : undefined)
            }
            onKeyDown={handleKeyDown}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress size={20} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box
            component="li"
            {...props}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 1,
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: option.color,
              }}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {option.name}
            </Typography>
          </Box>
        )}
        PaperComponent={({ children, ...paperProps }) => (
          <Paper {...paperProps}>
            {children}
            {shouldOfferCreate && (
              <Box
                sx={{
                  p: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
                onClick={() => {
                  setNewTagName(inputValue);
                  setCreateDialogOpen(true);
                }}
              >
                <AddIcon fontSize="small" />
                <Typography variant="body2">「{inputValue}」を新しいタグとして作成</Typography>
              </Box>
            )}
          </Paper>
        )}
      />

      {/*
       */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TagIcon />
            新しいタグを作成
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="タグ名"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            autoFocus
            margin="normal"
            helperText="わかりやすいタグ名を入力してください"
          />
          <FormControlLabel
            control={<Checkbox defaultChecked />}
            label="他のノードでも使用できるようにする"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleCreateTag} disabled={!newTagName.trim()}>
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
