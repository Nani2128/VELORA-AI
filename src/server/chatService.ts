import { db, MessageRecord } from './db';
import { chatRouter } from './chatProviders/router';
import { ChatSourceItem, ChatStreamChunk } from './chatProviders/types';
import { GoogleGenAI } from '@google/genai';

export type { ChatSourceItem, ChatStreamChunk };

class ChatService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  // --- Send Message and Stream Output with Multi-Provider Fallback ---
  async streamChat(
    conversationId: string,
    userMessage: string,
    options: {
      model?: string;
      webSearch?: boolean;
      mapsGrounding?: boolean;
      userLocation?: { latitude: number; longitude: number };
      signal?: AbortSignal;
    },
    onChunk: (chunk: ChatStreamChunk) => void
  ): Promise<MessageRecord> {
    // 1. Persist user message immediately
    db.addMessage(conversationId, 'user', userMessage);

    // 2. Fetch full conversation history for multi-turn context
    const conv = db.getConversation(conversationId);
    const messages = (conv?.messages || []).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    try {
      // 3. Delegate to prioritized AI Router (Gemini -> OpenAI -> Ollama -> Gateway)
      const result = await chatRouter.routeAndStreamChat(
        messages,
        {
          model: options.model,
          webSearch: options.webSearch,
          mapsGrounding: options.mapsGrounding,
          userLocation: options.userLocation,
          signal: options.signal,
        },
        onChunk
      );

      // 4. Save assistant message with real sources and provider tag
      const assistantMessage = db.addMessage(
        conversationId,
        'assistant',
        result.content.trim(),
        result.sources && result.sources.length > 0 ? result.sources : undefined,
        result.searchQueries && result.searchQueries.length > 0 ? result.searchQueries : undefined
      );

      // 5. Auto-title conversation if this is the first turn
      if (messages.length <= 2) {
        this.generateTitle(conversationId, userMessage).catch((e) =>
          console.warn('Auto-title failed:', e)
        );
      }

      onChunk({ type: 'done', messageId: assistantMessage.id });
      return assistantMessage;
    } catch (err: any) {
      console.error('Chat routing error:', err);
      const errorMessage = err?.message || 'Chat generation failed across available providers.';
      onChunk({ type: 'error', error: errorMessage });
      throw err;
    }
  }

  // --- Auto Generate Title ---
  private async generateTitle(conversationId: string, promptText: string) {
    try {
      if (process.env.GEMINI_API_KEY && this.ai) {
        const res = await this.ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Generate a concise, elegant 3 to 5 word topic title for a creative AI chat that starts with: "${promptText}". Return ONLY the title text with no quotation marks and no punctuation.`,
        });
        const title = res.text?.trim().replace(/^["']|["']$/g, '');
        if (title && title.length < 50) {
          db.updateConversation(conversationId, undefined, { title });
          return;
        }
      }
    } catch {
      // Non-fatal fallback
    }

    // Default title from prompt prefix
    const fallbackTitle = promptText.slice(0, 30).trim();
    if (fallbackTitle) {
      db.updateConversation(conversationId, undefined, { title: fallbackTitle });
    }
  }
}

export const chatService = new ChatService();
