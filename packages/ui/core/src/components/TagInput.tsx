import type React from 'react';

export type Tag = { id: string; name: string; color?: string };

export interface TagInputProps {
  value?: Tag[];
  onChange?: (tags: Tag[]) => void;
  placeholder?: string;
}

/**
 * Minimal TagInput implementation for plugin consumers.
 * Replace with a richer component when ready.
 */
export const TagInput: React.FC<TagInputProps> = ({ value = [], onChange: _onChange, placeholder }) => {
  return (
    <div data-ui-core="TagInput" style={{ border: '1px solid #ddd', padding: 8, borderRadius: 4 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Tags</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {value.length === 0 ? (
          <span style={{ color: '#999' }}>{placeholder ?? 'No tags'}</span>
        ) : (
          value.map((t) => (
            <span key={t.id} style={{
              display: 'inline-block',
              padding: '2px 6px',
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
