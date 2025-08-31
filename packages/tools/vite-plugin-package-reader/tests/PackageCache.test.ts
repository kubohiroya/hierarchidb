import { describe, it, expect, beforeEach } from 'vitest';
import { PackageCache } from '../src/core/PackageCache';
import type { PackageJson } from '../src/types';

describe('PackageCache', () => {
  let cache: PackageCache;
  
  beforeEach(() => {
    cache = new PackageCache();
  });

  it('should store and retrieve packages', () => {
    const pkg: PackageJson = {
      name: 'test-package',
      version: '1.0.0',
    };
    
    cache.set('test', pkg);
    const retrieved = cache.get('test');
    
    expect(retrieved).toEqual(pkg);
  });

  it('should return null for non-existent keys', () => {
    const result = cache.get('non-existent');
    expect(result).toBeNull();
  });

  it('should check if key exists', () => {
    const pkg: PackageJson = {
      name: 'test-package',
      version: '1.0.0',
    };
    
    cache.set('test', pkg);
    
    expect(cache.has('test')).toBe(true);
    expect(cache.has('non-existent')).toBe(false);
  });

  it('should delete entries', () => {
    const pkg: PackageJson = {
      name: 'test-package',
      version: '1.0.0',
    };
    
    cache.set('test', pkg);
    expect(cache.has('test')).toBe(true);
    
    const deleted = cache.delete('test');
    expect(deleted).toBe(true);
    expect(cache.has('test')).toBe(false);
  });

  it('should clear all entries', () => {
    cache.set('test1', { name: 'pkg1', version: '1.0.0' });
    cache.set('test2', { name: 'pkg2', version: '2.0.0' });
    
    expect(cache.size()).toBe(2);
    
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should handle TTL expiration', async () => {
    const cache = new PackageCache(100); // 100ms TTL
    const pkg: PackageJson = {
      name: 'test-package',
      version: '1.0.0',
    };
    
    cache.set('test', pkg);
    expect(cache.get('test')).toEqual(pkg);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(cache.get('test')).toBeNull();
  });

  it('should return cache statistics', () => {
    cache.set('test1', { name: 'pkg1', version: '1.0.0' });
    cache.set('test2', { name: 'pkg2', version: '2.0.0' });
    
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.valid).toBe(2);
    expect(stats.expired).toBe(0);
  });
});