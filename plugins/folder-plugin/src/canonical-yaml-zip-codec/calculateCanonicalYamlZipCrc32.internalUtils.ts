const CRC32_TABLE = new Uint32Array(256);

for (let tableIndex = 0; tableIndex < CRC32_TABLE.length; tableIndex += 1) {
  let value = tableIndex;
  for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[tableIndex] = value >>> 0;
}

export function calculateCanonicalYamlZipCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const tableIndex = (crc ^ byte) & 0xff;
    const tableValue = CRC32_TABLE[tableIndex];
    if (tableValue === undefined) {
      throw new Error('CRC32 table invariant failed');
    }
    crc = tableValue ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
