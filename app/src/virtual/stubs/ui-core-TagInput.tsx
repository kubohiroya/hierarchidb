import React from 'react';

export type Tag = { id: string; name: string; color?: string };

export interface TagInputProps {
  value?: Tag[];
  onChange?: (tags: Tag[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ value = [], onChange, placeholder }) => {
  // Minimal stub: render a readonly list to avoid runtime crashes in plugins that expect TagInput.
  return (
    <div data-stub="TagInput" style={{ border: '1px dashed #ccc', padding: 8, borderRadius: 4 }}>
      <strong>TagInput (stub)</strong>
      <div style={{ marginTop: 4 }}>
        {value.length === 0 ? (
          <span style={{ color: '#999' }}>{placeholder ?? 'No tags'}</span>
        ) : (
          value.map((t) => (
            <span key={t.id} style={{
              display: 'inline-block',
              padding: '2px 6px',
              marginRight: 4,
              marginBottom: 4,
              borderRadius: 4,
              background: t.color ?? '#eee',
              color: '#333',
              fontSize: 12,
            }}>{t.name}</span>
          ))
        )}
      </div>
    </div>
  );
};

export default TagInput;

