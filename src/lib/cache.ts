/**
 * Simple in-memory cache for parsed documents and analysis results
 * In production, consider using Redis or similar
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class Cache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private readonly defaultTTL: number = 60 * 60 * 1000; // 1 hour

  /**
   * Generate cache key from buffer
   */
  generateKey(buffer: Buffer, prefix: string = ''): string {
    const hash = createHash('sha256').update(buffer).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    this.store.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
    
    // Clean up old entries periodically
    if (this.store.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;
    
    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }
    
    return {
      total: this.store.size,
      active,
      expired,
    };
  }
}

export const cache = new Cache();

