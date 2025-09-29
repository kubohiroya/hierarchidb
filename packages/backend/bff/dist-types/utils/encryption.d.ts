/**
 * Encryption utilities for secure data storage
 */
/**
 * Derives an encryption key from a secret string
 */
export declare function deriveKey(secret: string): Promise<CryptoKey>;
/**
 * Encrypts data using AES-GCM
 */
export declare function encrypt(data: string, key: CryptoKey): Promise<string>;
/**
 * Decrypts data using AES-GCM
 */
export declare function decrypt(encryptedData: string, key: CryptoKey): Promise<string>;
/**
 * Generates a secure random token
 */
export declare function generateSecureToken(length?: number): string;
//# sourceMappingURL=encryption.d.ts.map