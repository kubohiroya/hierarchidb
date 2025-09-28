/**
  * TagInput Component
 * UI
  */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
import { Add as AddIcon, Delete as DeleteIcon, LocalOffer as TagIcon } from '@mui/icons-material';
import type { TagSuggestion as BaseTagSuggestion } from '@hierarchidb/common-type';
import type { TagId } from '@hierarchidb/common-type';

type TagSuggestion = Omit<BaseTagSuggestion, 'id'> & { id: TagId };

export interface TagInputProps {
  /**
   * ID
   */
  value: TagId[];
  /**
      */
  onChange: (tags: TagId[]) => void;
  /**
      */
  placeholder?: string;
  /**
      */
  maxTags?: number;
  /**
      */
  allowCreate?: boolean;
  /**
      */
  disabled?: boolean;
  /**
      */
  label?: string;
  /**
      */
  helperText?: string;
  /**
      */
  error?: boolean;
  /**
      */
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
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  //  workerTagService
  const mockSearchTags = useCallback(async (query: string): Promise<TagSuggestion[]> => {
    const mockTags: TagSuggestion[] = [
      { id: 'tag_1' as TagId, name: '重要', color: '#f44336', usageCount: 15 },
      { id: 'tag_2' as TagId, name: 'プロジェクト', color: '#2196f3', usageCount: 8 },
      { id: 'tag_3' as TagId, name: '完了', color: '#4caf50', usageCount: 12 },
      { id: 'tag_4' as TagId, name: 'レビュー待ち', color: '#ff9800', usageCount: 5 },
      { id: 'tag_5' as TagId, name: 'バックログ', color: '#9c27b0', usageCount: 3 },
    ];

    return mockTags.filter(tag =>
      tag.name.toLowerCase().includes(query.toLowerCase()),
    );
  }, []);

  const mockCreateTag = useCallback(async (name: string): Promise<TagSuggestion> => {
    const colors = ['#f44336', '#2196f3', '#4caf50', '#ff9800', '#9c27b0'] as const;
    return {
      id: `tag_${Date.now()}` as TagId,
      name,
      color: colors[Math.floor(Math.random() * colors.length)] as string,
      usageCount: 0,
    };
  }, []);

  const searchTags = useCallback(async (query: string) => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const results = await mockSearchTags(query);
      const filtered = results.filter(tag => !value.includes(tag.id));
      setSuggestions(filtered);
    } catch (error) {
      console.error('Tag search failed:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [mockSearchTags, value]);

  useEffect(() => {
    const loadSelectedTags = async () => {
      //  TagServiceTagIdTagSuggestion
      const mockSelected: TagSuggestion[] = value.map((id, index) => ({
        id,
        name: `Tag ${index + 1}`,
        color: '#2196f3',
        usageCount: 0,
      }));
      setSelectedTags(mockSelected);
    };

    loadSelectedTags();
  }, [value]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchTags(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchTags]);

  const handleTagAdd = useCallback((tag: TagSuggestion) => {
    if (value.length >= maxTags) {
      return;
    }

    if (!value.includes(tag.id)) {
      onChange([...value, tag.id]);
      setInputValue('');
    }
  }, [value, maxTags, onChange]);

  const handleTagRemove = useCallback((tagId: TagId) => {
    onChange(value.filter(id => id !== tagId));
  }, [value, onChange]);

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = await mockCreateTag(newTagName.trim());
      handleTagAdd(newTag);
      setNewTagName('');
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Tag creation failed:', error);
    }
  }, [newTagName, mockCreateTag, handleTagAdd]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && inputValue && allowCreate) {
      event.preventDefault();
      const existingTag = suggestions.find(tag =>
        tag.name.toLowerCase() === inputValue.toLowerCase(),
      );

      if (existingTag) {
        handleTagAdd(existingTag);
      } else {
        setNewTagName(inputValue);
        setCreateDialogOpen(true);
      }
    } else if (event.key === 'Backspace' && !inputValue && value.length > 0) {
      const lastTag = value[value.length - 1];
      if (lastTag) {
        handleTagRemove(lastTag);
      }
    }
  }, [inputValue, suggestions, allowCreate, value, handleTagAdd, handleTagRemove]);

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
        getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
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
            helperText={helperText || (value.length >= maxTags ? `最大${maxTags}個まで選択可能` : undefined)}
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
            <Typography variant="caption" color="text.secondary">
              {option.usageCount}回使用
            </Typography>
          </Box>
        )}
        PaperComponent={({ children, ...paperProps }) => (
          <Paper {...paperProps}>
            {children}
            {allowCreate && inputValue && !suggestions.some(s =>
              s.name.toLowerCase() === inputValue.toLowerCase(),
            ) && (
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
                <Typography variant="body2">
                  「{inputValue}」を新しいタグとして作成
                </Typography>
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
          <Button onClick={() => setCreateDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTag}
            disabled={!newTagName.trim()}
          >
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
