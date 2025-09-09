import React from 'react';

export interface CategorySelectorOption {
  value: string;
  label: string;
}

export interface CategorySelectorProps {
  value?: string;
  options?: CategorySelectorOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
}

/**
 * Minimal CategorySelector implementation for plugin consumers.
 */
export const CategorySelector: React.FC<CategorySelectorProps> = ({
                                                                    value,
                                                                    options = [],
                                                                    onChange,
                                                                    placeholder = 'Select category',
                                                                  }) => {
  return (
    <div data-ui-core="CategorySelector" style={{ border: '1px solid #ddd', padding: 8, borderRadius: 4 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Category</div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        style={{ padding: 6, minWidth: 200 }}
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
  );
};

export default CategorySelector;

