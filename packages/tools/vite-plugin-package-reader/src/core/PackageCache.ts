import type { PackageJson } from '../types.js';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
}

export class PackageCache {
  private cache = new Map<string, CacheEntry<PackageJson>>();
  private defaultTTL: number;

  constructor(defaultTTL = Infinity) {
    this.defaultTTL = defaultTTL;
  }

  set(key: string, value: PackageJson, ttl?: number): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  get(key: string): PackageJson | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): PackageJson[] {
    const values: PackageJson[] = [];
    for (const [key, entry] of this.cache) {
      if (!this.isExpired(entry)) {
        values.push(entry.data);
      } else {
        this.cache.delete(key);
      }
    }
    return values;
  }

  entries(): Map<string, PackageJson> {
    const result = new Map<string, PackageJson>();
    for (const [key, entry] of this.cache) {
      if (!this.isExpired(entry)) {
        result.set(key, entry.data);
      } else {
        this.cache.delete(key);
      }
    }
    return result;
  }

  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === Infinity) {
      return false;
    }
    return Date.now() - entry.timestamp > (entry.ttl ?? this.defaultTTL);
  }

  /**
            */
  cleanup(): number {
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
            */
  getStats(): {
    size: number;
    expired: number;
    valid: number;
  } {
    let expired = 0;
    let valid = 0;

    for (const [, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      size: this.cache.size,
      expired,
      valid,
    };
  }
}