/**
 * VELORA AI — Normalized Provider Error Contract & Classifier
 * 
 * Strict rule: Never expose raw provider payloads or stack traces to the frontend.
 * All upstream provider failures are parsed, classified, normalized, and mapped to actionable UI contracts.
 */

export type ProviderErrorCode =
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_QUOTA_EXHAUSTED'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_FORBIDDEN'
  | 'PROVIDER_MODEL_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_CONTENT_REJECTED'
  | 'PROVIDER_BAD_REQUEST'
  | 'PROVIDER_SERVER_ERROR'
  | 'NO_COMPATIBLE_PROVIDER'
  | 'GENERATION_FAILED'
  | 'SEARCH_FAILED'
  | 'STORAGE_FAILED'
  | 'DATABASE_FAILED';

export interface NormalizedProviderError {
  code: ProviderErrorCode;
  provider: string;
  model?: string;
  message: string;
  retryable: boolean;
  fallbackAvailable: boolean;
  switchedProvider?: string;
  suggestedProviders?: string[];
  retryAfter?: number; // In seconds
  quotaType?: 'PER_MINUTE' | 'DAILY' | 'MONTHLY' | 'BILLING';
  requestId?: string;
}

/**
 * Classifies any upstream error into a normalized provider error contract.
 */
export function classifyProviderError(
  err: any,
  provider: string,
  model?: string,
  requestId?: string
): NormalizedProviderError {
  const errStr = typeof err === 'string' ? err : err?.message || JSON.stringify(err || {});
  const statusCode = err?.status || err?.statusCode || err?.response?.status || 0;
  const lower = errStr.toLowerCase();

  // 1. Structured JSON extraction if error is a stringified JSON or contains JSON
  let structured: any = null;
  try {
    if (typeof err === 'object' && err !== null && (err.error || err.status)) {
      structured = err.error || err;
    } else {
      const match = errStr.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        structured = parsed.error || parsed;
      }
    }
  } catch {}

  const structuredCode = structured?.code || structured?.status || '';
  const structuredMsg = structured?.message || '';

  // Extract retry-after header or field if present
  let retryAfterSeconds: number | undefined;
  if (err?.headers && typeof err.headers.get === 'function') {
    const ra = err.headers.get('retry-after');
    if (ra) retryAfterSeconds = parseInt(ra, 10) || undefined;
  } else if (err?.retryAfter) {
    retryAfterSeconds = Number(err.retryAfter) || undefined;
  } else if (structured?.details) {
    // Check Google quota details
    for (const d of structured.details) {
      if (d?.metadata?.retryDelay) {
        retryAfterSeconds = parseInt(d.metadata.retryDelay, 10) || undefined;
      }
    }
  }

  // 2. Check Credit / Balance Exhaustion
  const isCreditExhausted =
    statusCode === 402 ||
    lower.includes('insufficient balance') ||
    lower.includes('insufficient_quota') ||
    lower.includes('credit_balance_exhausted') ||
    lower.includes('credits or licenses') ||
    lower.includes('no credits remaining') ||
    lower.includes('balance exhausted');

  if (isCreditExhausted) {
    return {
      code: 'PROVIDER_QUOTA_EXHAUSTED',
      provider,
      model,
      message: `${provider} account credits or balance exhausted. VELORA AI is automatically switching to a healthy alternative provider.`,
      retryable: false,
      fallbackAvailable: true,
      quotaType: 'BILLING',
      retryAfter: 3600,
      requestId,
    };
  }

  // 3. Check Quota vs Temporary Rate Limit
  const is429 = statusCode === 429 || structuredCode === 429 || structuredCode === 'RESOURCE_EXHAUSTED';
  const hasQuotaKeyword = lower.includes('quota') || lower.includes('resource_exhausted') || structuredMsg.toLowerCase().includes('quota');
  const hasDailyLimit = lower.includes('daily') || lower.includes('per day') || lower.includes('free_tier') || lower.includes('limit = 0') || lower.includes('exceeded your current quota');

  if (is429 || hasQuotaKeyword) {
    if (hasDailyLimit || lower.includes('billing') || lower.includes('plan')) {
      return {
        code: 'PROVIDER_QUOTA_EXHAUSTED',
        provider,
        model,
        message: `${provider} generation quota has been exhausted. VELORA AI is selecting an alternative available model.`,
        retryable: false,
        fallbackAvailable: true,
        quotaType: 'DAILY',
        retryAfter: retryAfterSeconds || 3600, // Cooldown for persistent daily quota
        requestId,
      };
    }

    return {
      code: 'PROVIDER_RATE_LIMITED',
      provider,
      model,
      message: `${provider} is temporarily busy or rate-limited. Retrying with a compatible provider.`,
      retryable: true,
      fallbackAvailable: true,
      quotaType: 'PER_MINUTE',
      retryAfter: retryAfterSeconds || 20,
      requestId,
    };
  }

  // 3. Authentication & Key Errors
  if (statusCode === 401 || lower.includes('api key not valid') || lower.includes('unauthorized') || lower.includes('invalid_api_key')) {
    return {
      code: 'PROVIDER_AUTH_ERROR',
      provider,
      model,
      message: `${provider} authentication could not be verified. Please check server configuration.`,
      retryable: false,
      fallbackAvailable: true,
      requestId,
    };
  }

  // 4. Permissions & Forbidden
  if (statusCode === 403 || lower.includes('permission_denied') || lower.includes('forbidden')) {
    return {
      code: 'PROVIDER_FORBIDDEN',
      provider,
      model,
      message: `Access to ${model || provider} is restricted by the upstream provider.`,
      retryable: false,
      fallbackAvailable: true,
      requestId,
    };
  }

  // 5. Model Not Found / Deprecated
  if (statusCode === 404 || lower.includes('not found') || lower.includes('model_not_found') || lower.includes('does not exist')) {
    return {
      code: 'PROVIDER_MODEL_UNAVAILABLE',
      provider,
      model,
      message: `Model ${model || 'requested'} is currently not recognized by ${provider}.`,
      retryable: false,
      fallbackAvailable: true,
      requestId,
    };
  }

  // 6. Safety & Content Moderation Policy
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('policy') || lower.includes('content_filter')) {
    return {
      code: 'PROVIDER_CONTENT_REJECTED',
      provider,
      model,
      message: 'Creative directive was flagged by provider safety guidelines. Please modify the prompt description.',
      retryable: false,
      fallbackAvailable: false, // Don't bypass safety
      requestId,
    };
  }

  // 7. Timeout
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return {
      code: 'PROVIDER_TIMEOUT',
      provider,
      model,
      message: `${provider} latency exceeded acceptable operational threshold.`,
      retryable: true,
      fallbackAvailable: true,
      requestId,
    };
  }

  // 8. Bad Request / Validation
  if (statusCode === 400 || lower.includes('bad request') || lower.includes('invalid_request')) {
    return {
      code: 'PROVIDER_BAD_REQUEST',
      provider,
      model,
      message: 'Invalid parameters sent to provider. Please adjust generation settings.',
      retryable: false,
      fallbackAvailable: true,
      requestId,
    };
  }

  // 9. Upstream 5xx
  if (statusCode >= 500 || lower.includes('internal error') || lower.includes('service unavailable')) {
    return {
      code: 'PROVIDER_SERVER_ERROR',
      provider,
      model,
      message: `${provider} upstream service is temporarily experiencing degraded performance.`,
      retryable: true,
      fallbackAvailable: true,
      requestId,
    };
  }

  // 10. Default fallback
  return {
    code: 'GENERATION_FAILED',
    provider,
    model,
    message: `${provider} was unable to complete the generation request.`,
    retryable: true,
    fallbackAvailable: true,
    requestId,
  };
}
