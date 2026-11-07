import Redis from 'ioredis';
import { config } from './index';
import { ttlDel, ttlGet, ttlSet } from '../utils/ttlCache';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (process.env.REDIS_DISABLED === 'true') return null;

  if (redis === null) {
    try {
      redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });
      redis.on('error', () => {
        // Suppress repeated connection errors when Redis is unavailable
      });
    } catch {
      return null;
    }
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (client) {
      const data = await client.get(key);
      if (data) return JSON.parse(data) as T;
    }
  } catch {
    // fall through to memory
  }
  return ttlGet<T>(key) ?? null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  // Always keep a local copy so hot paths stay fast when Redis is down.
  ttlSet(key, value, ttlSeconds * 1000);
  try {
    const client = getRedis();
    if (!client) return;
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Cache failure should not break the app
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  ttlDel(pattern.includes('*') ? pattern : pattern);
  try {
    const client = getRedis();
    if (!client) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Ignore cache errors
  }
}

export async function connectRedis(): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    await client.connect();
    console.log('✅ Redis connected');
  } catch {
    console.warn('⚠️ Redis not available, using in-memory cache');
    process.env.REDIS_DISABLED = 'true';
    redis = null;
  }
}
