declare module 'dexie' {
  const Dexie: any;
  export default Dexie;
}

declare module '@noble/hashes/sha3' {
  export const sha3_256: (input: Uint8Array) => Uint8Array;
}

