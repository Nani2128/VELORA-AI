/**
 * VELORA AI — Quota Manager & Provider Health State Machine
 * 
 * Manages operational states, rate limit detection, daily quota exhaustion,
 * bounded exponential backoff cooldowns, and automatic recovery across all AI providers.
 */

import { redisService } from '../redisClient';

export type ProviderHealthState =
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'AUTH_ERROR'
  | 'FORBIDDEN'
  | 'MODEL_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'DISABLED'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export interface ProviderQuotaInfo {
  provider: string;
  model?: string;
  state: ProviderHealthState;
  lastChecked: number;
  lastFailureTime?: number;
  consecutiveFailures: number;
  cooldownUntil?: number;
  quotaType?: 'PER_MINUTE' | 'DAILY' | 'MONTHLY' | 'BILLING';
  reason?: string;
  latencyMs?: number;
}

class QuotaManager {
  private localStates: Map<string, ProviderQuotaInfo> = new Map();
  private readonly BACKOFF_STEPS = [5, 10, 20, 40, 60, 120]; // seconds
  private readonly DAILY_COOLDOWN_SECONDS = 3600; // 1 hour for daily quota

  private getKey(provider: string, model?: string): string {
    return model ? `${provider}:${model}` : provider;
  }

  /**
   * Get current quota health state for a provider/model combination
   */
  async getHealth(provider: string, model?: string): Promise<ProviderQuotaInfo> {
    const key = this.getKey(provider, model);
    
    // Check Redis for cross-worker state
    const cached = await redisService.get(`quota:${key}`);
    if (cached) {
      try {
        const parsed: ProviderQuotaInfo = JSON.parse(cached);
        // Check if cooldown has expired
        if (parsed.cooldownUntil && Date.now() > parsed.cooldownUntil) {
          parsed.state = 'AVAILABLE';
          parsed.cooldownUntil = undefined;
          parsed.reason = undefined;
          await this.setHealth(provider, parsed);
        }
        return parsed;
      } catch {}
    }

    // Check local memory store
    const local = this.localStates.get(key);
    if (local) {
      if (local.cooldownUntil && Date.now() > local.cooldownUntil) {
        local.state = 'AVAILABLE';
        local.cooldownUntil = undefined;
        local.reason = undefined;
      }
      return local;
    }

    // Default state
    return {
      provider,
      model,
      state: 'AVAILABLE',
      lastChecked: Date.now(),
      consecutiveFailures: 0,
    };
  }

  /**
   * Set or update health state
   */
  async setHealth(provider: string, info: ProviderQuotaInfo): Promise<void> {
    const key = this.getKey(provider, info.model);
    this.localStates.set(key, info);

    const ttl = info.cooldownUntil ? Math.max(1, Math.round((info.cooldownUntil - Date.now()) / 1000)) : 86400;
    await redisService.set(`quota:${key}`, JSON.stringify(info), ttl);
  }

  /**
   * Mark a provider/model as successfully executed (resets failure count and clears cooldown)
   */
  async recordSuccess(provider: string, model?: string, latencyMs?: number): Promise<void> {
    const current = await this.getHealth(provider, model);
    const updated: ProviderQuotaInfo = {
      ...current,
      state: 'AVAILABLE',
      consecutiveFailures: 0,
      cooldownUntil: undefined,
      reason: undefined,
      latencyMs: latencyMs || current.latencyMs,
      lastChecked: Date.now(),
    };
    await this.setHealth(provider, updated);
  }

  /**
   * Mark a provider/model as rate-limited or quota-exhausted
   */
  async recordQuotaFailure(
    provider: string,
    model: string | undefined,
    isDailyQuota: boolean,
    reason: string,
    suggestedRetryAfter?: number
  ): Promise<ProviderQuotaInfo> {
    const current = await this.getHealth(provider, model);
    const consecutive = current.consecutiveFailures + 1;

    let cooldownSeconds: number;
    let state: ProviderHealthState;

    if (isDailyQuota) {
      state = 'QUOTA_EXHAUSTED';
      cooldownSeconds = suggestedRetryAfter || this.DAILY_COOLDOWN_SECONDS;
    } else {
      state = 'RATE_LIMITED';
      if (suggestedRetryAfter && suggestedRetryAfter > 0) {
        cooldownSeconds = suggestedRetryAfter;
      } else {
        const stepIndex = Math.min(consecutive - 1, this.BACKOFF_STEPS.length - 1);
        cooldownSeconds = this.BACKOFF_STEPS[Math.max(0, stepIndex)];
      }
    }

    const cooldownUntil = Date.now() + cooldownSeconds * 1000;
    const updated: ProviderQuotaInfo = {
      provider,
      model,
      state,
      lastChecked: Date.now(),
      lastFailureTime: Date.now(),
      consecutiveFailures: consecutive,
      cooldownUntil,
      quotaType: isDailyQuota ? 'DAILY' : 'PER_MINUTE',
      reason,
    };

    console.warn(`[QuotaManager] ${provider} (${model || 'all'}) marked ${state} for ${cooldownSeconds}s: ${reason}`);
    await this.setHealth(provider, updated);
    return updated;
  }

  /**
   * Mark a provider with an operational error (auth, forbidden, server error)
   */
  async recordOperationalFailure(
    provider: string,
    model: string | undefined,
    state: ProviderHealthState,
    reason: string
  ): Promise<void> {
    const current = await this.getHealth(provider, model);
    const updated: ProviderQuotaInfo = {
      ...current,
      state,
      lastChecked: Date.now(),
      lastFailureTime: Date.now(),
      consecutiveFailures: current.consecutiveFailures + 1,
      reason,
    };
    await this.setHealth(provider, updated);
  }

  /**
   * Check if provider is currently available to accept requests
   */
  async isAvailable(provider: string, model?: string): Promise<boolean> {
    const health = await this.getHealth(provider, model);
    return health.state === 'AVAILABLE' || health.state === 'DEGRADED';
  }
}

export const quotaManager = new QuotaManager();
