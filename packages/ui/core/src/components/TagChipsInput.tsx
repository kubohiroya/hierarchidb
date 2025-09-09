import React, { KeyboardEvent, useState } from 'react';

export interface TagChipsInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
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
                                                              placeholder = 'Enter tag and press Enter',
                                                              label = 'Tags',
                                                              maxTags = 20,
                                                              disabled = false,
                                                              helperText,
                                                              error = false,
                                                              required = false,
                                                              suggestions = [],
                                                            }) => {
  const [input, setInput] = useState('');

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

  const availableSuggestions = suggestions.filter((s) => s && !value.includes(s));

  return (
    <div data-ui-core="TagChipsInput" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>
        {label}{required ? ' *' : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {value.map((t) => (
          <span key={t} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#eee',
            borderRadius: 16,
            padding: '2px 8px',
          }}>
            <span>{t}</span>
            <button type="button" disabled={disabled} aria-label={`Remove ${t}`} onClick={() => removeTag(t)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || value.length >= maxTags}
        aria-invalid={error || undefined}
        aria-required={required || undefined}
        style={{ padding: 8, borderRadius: 4, border: `1px solid ${error ? '#d32f2f' : '#ddd'}`, maxWidth: 360 }}
      />
      {helperText && (
        <div style={{ color: error ? '#d32f2f' : '#666', fontSize: 12 }}>{helperText}</div>
      )}

      {availableSuggestions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }} aria-label="tag-suggestions">
          {availableSuggestions.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled || value.length >= maxTags}
              onClick={() => addTag(s)}
              style={{
                border: '1px solid #bbb',
                background: '#fafafa',
                padding: '2px 8px',
                borderRadius: 16,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagChipsInput;
