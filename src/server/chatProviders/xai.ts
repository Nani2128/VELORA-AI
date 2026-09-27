/**
 * VELORA AI — xAI Grok Chat Provider
 * 
 * Supports streaming chat, deep reasoning, live web search capability, and structured responses.
 */

import { BaseChatProvider } from './base';
import { 
  ChatStreamChunk, 
  ChatRequestOptions, 
  DiscoveredModel, 
  ProviderHealthState 
} from './types';
import { classifyProviderError } from '../errors/normalizedError';
import { quotaManager } from '../router/quotaManager';

export class XAIChatProvider extends BaseChatProvider {
  id = 'xai';
  name = 'xAI Grok';
  costClass = 'PAID_API' as const;

  isConfigured(): boolean {
    return !!process.env.XAI_API_KEY;
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    return [
      {
        id: 'grok-beta',
        name: 'Grok 2 Beta',
        provider: 'xai',
        description: 'Advanced real-time conversational intelligence with truth-seeking reasoning.',
        contextWindow: 131072,
        supportsVision: false,
        supportsStreaming: true,
        supportsTools: true,
        supportsReasoning: true,
        costClass: 'PAID_API',
        capabilities: ['chat', 'reasoning', 'tools'],
      },
    ];
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        status: 'UNAVAILABLE',
        isConfigured: false,
        cooldownUntil: null,
        lastChecked: Date.now(),
        consecutiveFailures: 0,
        costClass: this.costClass,
        lastError: 'XAI_API_KEY is not configured',
      };
    }
    const qState = await quotaManager.getHealth('xai', 'grok-beta');
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return {
        status: 'RATE_LIMITED',
        isConfigured: true,
        cooldownUntil: qState.cooldownUntil ?? null,
        lastChecked: Date.now(),
        consecutiveFailures: 1,
        costClass: this.costClass,
        lastError: qState.reason,
      };
    }
    return {
      status: 'HEALTHY',
      isConfigured: true,
      cooldownUntil: null,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
      costClass: this.costClass,
      averageLatencyMs: qState.latencyMs || 500,
    };
  }

  async streamChat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: ChatRequestOptions,
    onChunk: (chunk: ChatStreamChunk) => void
  ): Promise<{ 
    content: string; 
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } 
  }> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new Error('PROVIDER_UNCONFIGURED: XAI_API_KEY is missing.');
    }

    const isXAIModel = options.model && (options.model.startsWith('grok') || options.model.includes('xai'));
    const model = isXAIModel ? options.model! : (process.env.XAI_CHAT_MODEL || 'grok-beta');
    const startTime = Date.now();

    try {
      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const classified = classifyProviderError(errorData, 'xai', model);
        await quotaManager.recordQuotaFailure(
          'xai',
          model,
          classified.code === 'PROVIDER_QUOTA_EXHAUSTED',
          classified.message,
          classified.retryAfter
        );
        const err: any = new Error(classified.message);
        err.code = classified.code;
        throw err;
      }

      if (!resp.body) {
        throw new Error('Empty response body from xAI Grok.');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk({ type: 'delta', delta });
            }
          } catch {}
        }
      }

      await quotaManager.recordSuccess('xai', model, Date.now() - startTime);
      return { content: fullContent };
    } catch (err: any) {
      const classified = classifyProviderError(err, 'xai', model);
      const customErr: any = new Error(classified.message);
      customErr.code = classified.code;
      throw customErr;
    }
  }
}

export const xaiChatProvider = new XAIChatProvider();
