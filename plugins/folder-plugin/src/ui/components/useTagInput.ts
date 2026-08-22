import type { TagSuggestion as BaseTagSuggestion, TagId } from '@hierarchidb/tag-api';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TagSuggestion = Omit<BaseTagSuggestion, 'id'> & { id: TagId };

interface UseTagInputProps {
  value: TagId[];
  onChange: (tags: TagId[]) => void;
  maxTags: number;
  allowCreate: boolean;
}

export function useTagInput({ value, onChange, maxTags, allowCreate }: UseTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const mockSearchTags = useCallback(async (query: string): Promise<TagSuggestion[]> => {
    const mockTags: TagSuggestion[] = [
      { id: 'tag_1' as TagId, name: '重要', color: '#f44336' },
      { id: 'tag_2' as TagId, name: 'プロジェクト', color: '#2196f3' },
      { id: 'tag_3' as TagId, name: '完了', color: '#4caf50' },
      { id: 'tag_4' as TagId, name: 'レビュー待ち', color: '#ff9800' },
      { id: 'tag_5' as TagId, name: 'バックログ', color: '#9c27b0' },
    ];

    return mockTags.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()));
  }, []);

  const mockCreateTag = useCallback(async (name: string): Promise<TagSuggestion> => {
    const colors = ['#f44336', '#2196f3', '#4caf50', '#ff9800', '#9c27b0'] as const;
    return {
      id: `tag_${Date.now()}` as TagId,
      name,
      color: colors[Math.floor(Math.random() * colors.length)] as string,
    };
  }, []);

  const searchTags = useCallback(
    async (query: string) => {
      if (!query) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const results = await mockSearchTags(query);
        const filtered = results.filter((tag) => !value.includes(tag.id));
        setSuggestions(filtered);
      } catch (error) {
        console.error('Tag search failed:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [mockSearchTags, value]
  );

  useEffect(() => {
    const loadSelectedTags = async () => {
      const mockSelected: TagSuggestion[] = value.map((id, index) => ({
        id,
        name: `Tag ${index + 1}`,
        color: '#2196f3',
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

  const handleTagAdd = useCallback(
    (tag: TagSuggestion) => {
      if (value.length >= maxTags) {
        return;
      }

      if (!value.includes(tag.id)) {
        onChange([...value, tag.id]);
        setInputValue('');
      }
    },
    [value, maxTags, onChange]
  );

  const handleTagRemove = useCallback(
    (tagId: TagId) => {
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange]
  );

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

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && inputValue && allowCreate) {
        event.preventDefault();
        const existingTag = suggestions.find(
          (tag) => tag.name.toLowerCase() === inputValue.toLowerCase()
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
    },
    [inputValue, suggestions, allowCreate, value, handleTagAdd, handleTagRemove]
  );

  const shouldOfferCreate = useMemo(
    () =>
      allowCreate &&
      inputValue &&
      !suggestions.some((s) => s.name.toLowerCase() === inputValue.toLowerCase()),
    [allowCreate, inputValue, suggestions]
  );

  return {
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
  };
}
