import type { HashAlgorithm, HashPort } from '../ports';
import { sha3_256 } from '@noble/hashes/sha3';

export class NobleSha3HashPort implements HashPort {
  digest(buffer: ArrayBuffer, algo: HashAlgorithm): string {
    if (algo === 'sha3-256') {
      const out = sha3_256(new Uint8Array(buffer));
      return toHex(out);
    }
    throw new Error(`Unsupported algo: ${algo}`);
  }
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

