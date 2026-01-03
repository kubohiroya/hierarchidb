import { sha3_256 } from '@noble/hashes/sha3';
import type { HashAlgorithm, HashPort } from '../ports.js';

export class NobleSha3HashPort implements HashPort {
  digest(buffer: ArrayBuffer, algo: HashAlgorithm): string {
    if (algo === 'sha3-256') {
      const out = sha3_256(new Uint8Array(buffer));
      return Array.from(out).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    throw new Error(`Unsupported hash algorithm: ${algo}`);
  }
}
