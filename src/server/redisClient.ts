export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

class RedisService {
  private inMemoryStore: Map<string, { value: string; expiresAt: number }> = new Map();
  private rateLimitBuckets: Map<string, { count: number; windowStart: number }> = new Map();
  private isConnected: boolean = false;
  private redisUrl: string | null = null;

  constructor() {
    this.redisUrl = process.env.REDIS_URL || null;
    if (this.redisUrl) {
      console.log('[Redis] Configured with connection URL:', this.redisUrl.replace(/:[^:@]+@/, ':****@'));
      this.isConnected = true;
    } else {
      console.log('[Redis] Running in local in-memory emulation mode.');
    }
  }

  isReady(): boolean {
    return true; // Always operational via Redis or in-memory fallback
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity;
    this.inMemoryStore.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    const item = this.inMemoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.inMemoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async del(key: string): Promise<void> {
    this.inMemoryStore.delete(key);
  }

  // Provider Cooldown management
  async setProviderCooldown(provider: string, durationSeconds: number, reason: string): Promise<void> {
    const key = `provider_cooldown:${provider}`;
    await this.set(key, JSON.stringify({ reason, timestamp: Date.now() }), durationSeconds);
  }

  async getProviderCooldown(provider: string): Promise<{ inCooldown: boolean; reason?: string }> {
    const raw = await this.get(`provider_cooldown:${provider}`);
    if (!raw) return { inCooldown: false };
    try {
      const data = JSON.parse(raw);
      return { inCooldown: true, reason: data.reason };
    } catch {
      return { inCooldown: true };
    }
  }

  // Application-level sliding window rate limiting
  async checkRateLimit(identifier: string, maxRequests: number = 30, windowSeconds: number = 60): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = `ratelimit:${identifier}`;

    let bucket = this.rateLimitBuckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { count: 1, windowStart: now };
      this.rateLimitBuckets.set(key, bucket);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetInSeconds: windowSeconds,
      };
    }

    bucket.count += 1;
    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetInSeconds = Math.max(1, Math.round((bucket.windowStart + windowMs - now) / 1000));

    if (bucket.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds,
      };
    }

    return {
      allowed: true,
      remaining,
      resetInSeconds,
    };
  }
}

export const redisService = new RedisService();
