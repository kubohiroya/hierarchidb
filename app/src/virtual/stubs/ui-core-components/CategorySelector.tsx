import type React from 'react';

export interface CategorySelectorProps {
  value?: string;
  options?: { value: string; label: string }[];
  onChange?: (value: string) => void;
  placeholder?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  options = [],
  onChange,
  placeholder = 'Select category',
}) => {
  return (
    <div
      data-stub="CategorySelector"
      style={{ border: '1px dashed #ccc', padding: 8, borderRadius: 4 }}
    >
      <strong>CategorySelector (stub)</strong>
      <div style={{ marginTop: 4 }}>
        <select
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          style={{ padding: 4, minWidth: 180 }}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default CategorySelector;
