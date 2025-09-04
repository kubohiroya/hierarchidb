declare module '@hierarchidb/ui-core/components/TagInput' {
  import type React from 'react';
  type TagId = string;
  type TagEntity = { id: TagId; name?: string };
  export interface TagInputProps {
    selectedTags: TagId[];
    onTagsChange: (tags: TagEntity[]) => void;
    placeholder?: string;
    disabled?: boolean;
    maxTags?: number;
    suggestionLimit?: number;
  }
  export const TagInput: React.FC<TagInputProps>;
  export default TagInput;
}

declare module '@hierarchidb/ui-core/components/CategorySelector' {
  export interface CategoryOption { value: string; label: string; color?: string }
  export interface CategorySelectorProps<T extends string = string> {
    options: Array<{ value: T; label: string; color?: string }>;
    selectedCategory?: T;
    onCategoryChange: (value: T | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
  }
  export function CategorySelector<T extends string = string>(props: CategorySelectorProps<T>): JSX.Element;
  export default CategorySelector;
}
