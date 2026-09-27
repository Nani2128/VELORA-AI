import { apiFetch } from './client';
import { Conversation, ChatMessage, ChatSource } from '../../types';

export async function fetchConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/v1/chat/conversations');
}

export async function createConversation(payload: {
  title?: string;
  model?: string;
  web_search_enabled?: boolean;
}): Promise<Conversation> {
  return apiFetch<Conversation>('/api/v1/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchConversation(id: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/v1/chat/conversations/${encodeURIComponent(id)}`);
}

export async function updateConversation(
  id: string,
  update: { title?: string; model?: string; web_search_enabled?: boolean }
): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/v1/chat/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export async function deleteConversation(id: string): Promise<{ success: boolean; deleted_id: string }> {
  return apiFetch<{ success: boolean; deleted_id: string }>(`/api/v1/chat/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface StreamChatCallbacks {
  onDelta?: (delta: string) => void;
  onSources?: (sources: ChatSource[], searchQueries: string[]) => void;
  onDone?: (messageId?: string) => void;
  onError?: (error: string, errorObj?: any) => void;
  onProviderSelected?: (provider: string, task?: string) => void;
  onProviderRateLimited?: (provider: string, reason?: string) => void;
  onProviderSwitched?: (fromProvider: string, toProvider: string, reason?: string) => void;
  onUsage?: (usage: any) => void;
}

export async function sendChatMessageStream(
  conversationId: string,
  content: string,
  options: { 
    model?: string; 
    webSearch?: boolean; 
    mapsGrounding?: boolean;
    userLocation?: { latitude: number; longitude: number };
    signal?: AbortSignal 
  },
  callbacks: StreamChatCallbacks
): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages?stream=true`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      content,
      model: options.model,
      web_search_enabled: options.webSearch,
      maps_grounding_enabled: options.mapsGrounding,
      user_location: options.userLocation,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = { error: { message: errorText } };
    }
    const errObj = parsed?.error || parsed;
    throw new Error(errObj?.message || `Chat API error (${response.status})`);
  }

  if (!response.body) {
    throw new Error('No readable stream available in response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = 'message';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.replace('event:', '').trim();
      } else if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.replace('data:', '').trim();
        try {
          const parsed = JSON.parse(jsonStr);

          // Handle SSE events
          if (currentEvent === 'delta' || currentEvent === 'chat.token' || parsed.type === 'delta' || parsed.type === 'chat.token') {
            if (parsed.delta) callbacks.onDelta?.(parsed.delta);
          } else if (currentEvent === 'sources' || parsed.type === 'sources') {
            callbacks.onSources?.(parsed.sources || [], parsed.searchQueries || []);
          } else if (currentEvent === 'provider.selected' || parsed.type === 'provider.selected') {
            callbacks.onProviderSelected?.(parsed.provider, parsed.task);
          } else if (currentEvent === 'provider.rate_limited' || parsed.type === 'provider.rate_limited') {
            callbacks.onProviderRateLimited?.(parsed.provider, parsed.reason);
          } else if (
            currentEvent === 'provider.switched' || 
            currentEvent === 'provider_switched' || 
            parsed.type === 'provider_switched' ||
            parsed.type === 'provider.switched'
          ) {
            callbacks.onProviderSwitched?.(parsed.fromProvider, parsed.toProvider || parsed.provider, parsed.reason);
          } else if (currentEvent === 'done' || currentEvent === 'chat.completed' || parsed.type === 'done' || parsed.type === 'chat.completed') {
            if (parsed.usage) callbacks.onUsage?.(parsed.usage);
            callbacks.onDone?.(parsed.messageId);
          } else if (currentEvent === 'error' || currentEvent === 'chat.failed' || parsed.type === 'error' || parsed.type === 'chat.failed') {
            const rawErr = parsed.error || parsed;
            const errMsg = typeof rawErr === 'object' ? (rawErr.message || rawErr.code || 'Chat error') : String(rawErr);
            callbacks.onError?.(errMsg, typeof rawErr === 'object' ? rawErr : undefined);
          }
        } catch {
          // Non-JSON SSE event data
        }
      }
    }
  }

  callbacks.onDone?.();
}
