import { describe, expect, it } from 'vitest';
import { ProjectEntitySerializer } from '../serialization';

describe('ProjectEntitySerializer', () => {
  it('extracts Uint8Array into binary map and leaves UUID in json', () => {
    const input = {
      id: 'e1',
      name: 'P',
      payload_Uint8Array: new Uint8Array([1, 2, 3]),
      nested: { more_Uint8Array: new Uint8Array([9, 8, 7]) },
    };

    const { jsonData, binaryData, binaryFilenames } = ProjectEntitySerializer.serialize(input);
    // json retains strings for those fields
    expect(typeof jsonData.payload_Uint8Array).toBe('string');
    expect(typeof jsonData.nested.more_Uint8Array).toBe('string');
    // binary maps hold two entries
    expect(binaryData.size).toBe(2);
    expect(binaryFilenames.size).toBe(2);

    const restored = ProjectEntitySerializer.deserialize({ jsonData, binaryData });
    expect(restored.payload_Uint8Array).toBeInstanceOf(Uint8Array);
    expect(restored.nested.more_Uint8Array).toBeInstanceOf(Uint8Array);
  });

  it('extracts ArrayBuffer into binary map', () => {
    const buf = new Uint8Array([10, 20, 30]).buffer;
    const input = { id: 'e2', tileData: buf };
    const { jsonData, binaryData } = ProjectEntitySerializer.serialize(input);
    expect(typeof jsonData.tileData).toBe('string');
    expect(binaryData.size).toBe(1);

    const restored = ProjectEntitySerializer.deserialize({ jsonData, binaryData });
    // Restored as Uint8Array view
    expect(restored.tileData).toBeInstanceOf(Uint8Array);
    expect(Array.from(restored.tileData)).toEqual([10, 20, 30]);
  });
});

