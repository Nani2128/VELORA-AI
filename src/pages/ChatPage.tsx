import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { 
  fetchConversations, 
  createConversation, 
  fetchConversation, 
  updateConversation, 
  deleteConversation, 
  sendChatMessageStream 
} from '../lib/api/chat';
import { normalizeAPIError, NormalizedUIError } from '../lib/api/errors';
import { fetchChatModels, ChatModelDescriptor } from '../lib/api/models';
import { Conversation, ChatMessage, ChatSource } from '../types';
import { 
  Plus, 
  MessageSquare, 
  Globe, 
  Send, 
  Square, 
  RotateCcw, 
  Copy, 
  Check, 
  Trash2, 
  Edit2, 
  Sparkles, 
  ExternalLink, 
  Cpu, 
  Search,
  ChevronRight,
  AlertCircle,
  Image as ImageIcon,
  Film,
  Zap,
  MapPin,
  Radio
} from 'lucide-react';
import { marked } from 'marked';
import { Button } from '../components/ui/Button';
import { LiveVoiceModal } from '../components/studio/LiveVoiceModal';

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const ChatPage: React.FC = () => {
  const { user, addToast, navigate, setPrompt, setGenerationType } = useAppStore();
  
  // Conversations list & Active Conversation
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingConv, setIsLoadingConv] = useState(false);

  // Input & Generation State
  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [mapsGroundingEnabled, setMapsGroundingEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [installedOllamaModels, setInstalledOllamaModels] = useState<string[]>([]);
  const [discoveredModels, setDiscoveredModels] = useState<ChatModelDescriptor[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState<{ from: string; to?: string; reason?: string } | null>(null);
  const [activeStreamProvider, setActiveStreamProvider] = useState<string | null>(null);

  // Streaming assistant message state
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<ChatSource[]>([]);
  const [streamingQueries, setStreamingQueries] = useState<string[]>([]);
  const [chatError, setChatError] = useState<NormalizedUIError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Editing title
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [newTitleText, setNewTitleText] = useState('');

  // Copied message state
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConv?.messages, streamingContent, chatError]);

  // Load conversations, discover dynamic chat models & Ollama models on mount
  useEffect(() => {
    loadConversations();
    fetchChatModels()
      .then((models) => {
        if (Array.isArray(models)) {
          setDiscoveredModels(models);
        }
      })
      .catch(() => {});

    fetch('/api/v1/providers/ollama/models')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.models && Array.isArray(data.models)) {
          setInstalledOllamaModels(data.models);
        }
      })
      .catch(() => {});
  }, []);

  const loadConversations = async () => {
    setIsLoadingList(true);
    try {
      const list = await fetchConversations();
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        selectConversation(list[0].id);
      } else if (list.length === 0) {
        handleNewChat();
      }
    } catch (err: any) {
      console.warn('Failed to load conversations:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    setIsLoadingConv(true);
    setChatError(null);
    try {
      const conv = await fetchConversation(id);
      setActiveConv(conv);
      setWebSearchEnabled(conv.webSearchEnabled ?? false);
      setSelectedModel(conv.model || 'gemini-3.8-flash');
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
    } finally {
      setIsLoadingConv(false);
    }
  };

  const handleNewChat = async () => {
    if (isGenerating) return;
    setChatError(null);
    try {
      const newConv = await createConversation({
        title: 'New Creative Chat',
        model: selectedModel,
        web_search_enabled: webSearchEnabled,
      });
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setActiveConv({ ...newConv, messages: [] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to create new chat' });
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
      addToast({ type: 'info', title: 'Chat Deleted', message: 'Conversation removed.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to delete conversation.' });
    }
  };

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(conv.id);
    setNewTitleText(conv.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!newTitleText.trim()) return;
    try {
      await updateConversation(id, { title: newTitleText.trim() });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitleText.trim() } : c))
      );
      if (activeConv && activeConv.id === id) {
        setActiveConv({ ...activeConv, title: newTitleText.trim() });
      }
      setEditingTitleId(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to rename conversation.' });
    }
  };

  // Submit User Message with Real Streaming & Multi-Provider Fallback
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isGenerating || !activeConvId) return;

    setInputPrompt('');
    setIsGenerating(true);
    setChatError(null);
    setStreamingContent('');
    setStreamingSources([]);
    setStreamingQueries([]);
    setFallbackNotice(null);
    setActiveStreamProvider(null);

    // Optimistically append user message
    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      conversationId: activeConvId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setActiveConv((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...(prev.messages || []), tempUserMsg],
      };
    });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedText = '';

    try {
      await sendChatMessageStream(
        activeConvId,
        text,
        {
          model: (webSearchEnabled || mapsGroundingEnabled) ? 'gemini-3.5-flash' : selectedModel,
          webSearch: webSearchEnabled,
          mapsGrounding: mapsGroundingEnabled,
          userLocation,
          signal: abortController.signal,
        },
        {
          onDelta: (delta) => {
            accumulatedText += delta;
            setStreamingContent((prev) => prev + delta);
          },
          onSources: (sources, queries) => {
            setStreamingSources(sources);
            setStreamingQueries(queries);
          },
          onProviderSelected: (provider) => {
            setActiveStreamProvider(provider);
          },
          onProviderRateLimited: (provider, reason) => {
            setFallbackNotice({
              from: provider,
              reason: reason || 'Rate limit / quota exceeded',
            });
          },
          onProviderSwitched: (fromProvider, toProvider, reason) => {
            setFallbackNotice({
              from: fromProvider,
              to: toProvider,
              reason: reason || 'Provider quota exhausted. Auto-failover activated.',
            });
            setActiveStreamProvider(toProvider);
          },
          onDone: async () => {
            setIsGenerating(false);
            setStreamingContent('');
            setStreamingSources([]);
            setStreamingQueries([]);
            // Reload full conversation from backend to sync message IDs and auto-generated title
            try {
              const updated = await fetchConversation(activeConvId);
              setActiveConv(updated);
              setConversations((prev) =>
                prev.map((c) => (c.id === activeConvId ? { ...c, title: updated.title } : c))
              );
            } catch (e) {
              // ignore
            }
          },
          onError: (error, errorObj) => {
            setIsGenerating(false);
            const normalized = normalizeAPIError(errorObj || error);
            setChatError(normalized);
          },
        }
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const normalized = normalizeAPIError(err);
        setChatError(normalized);
      }
      setIsGenerating(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    addToast({ type: 'info', title: 'Stopped', message: 'Response generation halted.' });
  };

  const handleRegenerate = async () => {
    if (!activeConv?.messages || activeConv.messages.length === 0 || isGenerating) return;
    const messages = activeConv.messages;
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex !== -1) {
      const userText = messages[lastUserIndex].content;
      handleSendMessage(userText);
    }
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
    addToast({ type: 'success', title: 'Copied', message: 'Message copied to clipboard.' });
  };

  // Launch Studio Creation with prompt from Chat
  const handleLaunchStudioGeneration = (promptText: string, type: 'TEXT_TO_IMAGE' | 'TEXT_TO_VIDEO') => {
    setGenerationType(type);
    setPrompt(promptText);
    navigate(type === 'TEXT_TO_VIDEO' ? '/app/video' : '/app/image');
    addToast({
      type: 'info',
      title: 'Loaded in Studio',
      message: `Prompt preloaded for ${type === 'TEXT_TO_VIDEO' ? 'video' : 'image'} generation.`,
    });
  };

  const suggestionPrompts = [
    {
      title: 'Visual Prompt Director',
      desc: 'Craft a 35mm cinematic film noir prompt with anamorphic lens flare',
      prompt: 'Act as my visual prompt director. Write a high-concept, photorealistic prompt for a 35mm cinematic film noir scene with anamorphic cyan flares, volumetric rain, and moody shadow framing.',
    },
    {
      title: 'FLUX vs SD Comparison',
      desc: 'Technical breakdown of FLUX.1 vs SDXL for character rendering',
      prompt: 'Compare Black Forest Labs FLUX.1 [schnell] vs Stability AI SDXL for character anatomy, prompt adherence, and speed.',
    },
    {
      title: 'Live Web Research',
      desc: 'Search recent generative AI video models and benchmark results',
      prompt: 'Search the web for the latest generative AI video models and summarize key performance differences.',
      autoSearch: true,
    },
    {
      title: 'Cinematic Storyboard',
      desc: 'Design a 4-beat sequence for an evocative cyberpunk short film',
      prompt: 'Create a 4-beat visual storyboard description for a cyberpunk short film, detailing camera angles, color grading, and lighting for each beat.',
    },
  ];

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full gap-4 max-w-7xl mx-auto overflow-hidden">
      {/* ========================================================= */}
      {/* LEFT: Conversation History Sidebar */}
      {/* ========================================================= */}
      <aside className="w-72 shrink-0 hidden md:flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        {/* Header & New Chat Button */}
        <div className="p-3 border-b border-[var(--border-subtle)] flex flex-col gap-2">
          <button
            onClick={handleNewChat}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>New Consultation</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {isLoadingList ? (
            <div className="p-4 text-xs text-[var(--text-muted)] text-center animate-pulse">
              Loading chat sessions...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              No conversations yet. Start a new one above.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const isEditing = editingTitleId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer select-none ${
                    isActive
                      ? 'border-amber-500/40 bg-amber-500/10 text-[var(--text-primary)] font-semibold shadow-2xs'
                      : 'border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-500' : 'text-slate-400'}`} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={newTitleText}
                        onChange={(e) => setNewTitleText(e.target.value)}
                        onBlur={() => handleSaveRename(conv.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(conv.id);
                          if (e.key === 'Escape') setEditingTitleId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-amber-500 text-xs focus:outline-none text-[var(--text-primary)]"
                      />
                    ) : (
                      <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                    )}
                  </div>

                  {/* Actions (Rename, Delete) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartRename(conv, e)}
                      className="p-1 rounded text-slate-400 hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5"
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT: Active Chat Main Viewport */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        {/* Top Control Bar */}
        <div className="h-14 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-[var(--text-primary)] truncate">
                {activeConv?.title || 'Studio AI Director'}
              </h2>
              <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <span>Multi-turn Creative Intelligence · Auto-Fallback Enabled</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector in Chat */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-xl text-xs">
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer max-w-[210px] truncate"
              >
                <option value="auto">⚡ Auto Routing (Multi-Provider Mesh)</option>
                
                <optgroup label="Google Gemini">
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Fast & Fluid)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep Reasoning)</option>
                </optgroup>

                <optgroup label="Groq LPU Engine">
                  <option value="llama-3.3-70b-versatile">Groq · Llama 3.3 70B (Versatile)</option>
                  <option value="llama-3.1-8b-instant">Groq · Llama 3.1 8B (Instant)</option>
                </optgroup>

                <optgroup label="DeepSeek AI">
                  <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                </optgroup>

                <optgroup label="OpenAI Cloud">
                  <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                </optgroup>

                <optgroup label="Hugging Face Inference">
                  <option value="meta-llama/Llama-3.2-3B-Instruct">HF · Llama 3.2 3B Instruct</option>
                  <option value="Qwen/Qwen2.5-72B-Instruct">HF · Qwen 2.5 72B Instruct</option>
                </optgroup>

                {installedOllamaModels.length > 0 && (
                  <optgroup label="Local Ollama Models">
                    {installedOllamaModels.map((m) => (
                      <option key={m} value={m}>
                        {m} (Local)
                      </option>
                    ))}
                  </optgroup>
                )}

                {discoveredModels.length > 0 && (
                  <optgroup label="Discovered Engine Models">
                    {discoveredModels
                      .filter((dm) => !['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'llama-3.3-70b-versatile', 'deepseek-chat', 'gpt-4o-mini', 'gpt-4o'].includes(dm.id))
                      .map((dm) => (
                        <option key={dm.id} value={dm.id}>
                          {dm.name} ({dm.provider})
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Web Search Toggle in Header */}
            <button
              type="button"
              onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-2xs ${
                webSearchEnabled
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Toggle Live Web Search Grounding"
            >
              <Globe className={`w-3.5 h-3.5 ${webSearchEnabled ? 'text-blue-500 animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Web Search</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono-numbers font-semibold ${
                  webSearchEnabled ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300' : 'bg-slate-300/40 dark:bg-white/10'
                }`}
              >
                {webSearchEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Message Stream Viewport */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
          {/* Active Auto-Failover Notification */}
          {fallbackNotice && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 animate-bounce" />
                <span>
                  <strong className="font-semibold">Auto-Failover Active:</strong> Quota/rate-limit hit on{' '}
                  <span className="font-mono font-bold">{fallbackNotice.from}</span>. Seamlessly switched to{' '}
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {fallbackNotice.to || 'secondary provider'}
                  </span>
                  .
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFallbackNotice(null)}
                className="text-[11px] font-semibold underline hover:no-underline text-amber-700 dark:text-amber-300 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoadingConv ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
              Loading conversation...
            </div>
          ) : !activeConv?.messages || activeConv.messages.length === 0 ? (
            /* Empty State: Suggestion Prompts */
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 shadow-sm">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="font-display text-lg md:text-xl font-bold text-[var(--text-primary)] mb-2">
                VELORA Studio AI Assistant
              </h3>
              <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-6 max-w-md leading-relaxed">
                Direct conversational guidance with multi-provider routing (Gemini, OpenAI, Ollama), prompt tuning, and grounded web research.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                {suggestionPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (item.autoSearch) setWebSearchEnabled(true);
                      handleSendMessage(item.prompt);
                    }}
                    className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-left group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-amber-500 transition-colors">
                        {item.title}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Rendered Messages */
            activeConv.messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} w-full`}
                >
                  <div
                    className={`flex gap-3 max-w-[85%] md:max-w-[78%] ${
                      isAssistant ? 'flex-row' : 'flex-row-reverse'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs select-none shadow-2xs ${
                        isAssistant
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-display'
                          : 'bg-slate-700 text-white'
                      }`}
                    >
                      {isAssistant ? 'V' : user.avatarInitials}
                    </div>

                    {/* Content Box */}
                    <div className="flex flex-col gap-1.5">
                      <div
                        className={`rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                          isAssistant
                            ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                            : 'bg-amber-500 text-slate-950 font-medium'
                        }`}
                      >
                        {isAssistant ? (
                          <div
                            className="prose prose-xs dark:prose-invert max-w-none text-xs break-words"
                            dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>

                      {/* Web & Maps Grounding Sources */}
                      {isAssistant && msg.sources && msg.sources.length > 0 && (
                        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-2 mt-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
                            {msg.sources.some(s => s.domain?.includes('maps') || s.placeInfo) ? (
                              <>
                                <MapPin className="w-3 h-3 text-emerald-500" />
                                <span>Google Maps Places & Grounded Citations ({msg.sources.length})</span>
                              </>
                            ) : (
                              <>
                                <Globe className="w-3 h-3 text-blue-500" />
                                <span>Grounded Search Sources ({msg.sources.length})</span>
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, sIdx) => {
                              const isMap = src.domain?.includes('maps') || !!src.placeInfo;
                              return (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer shadow-2xs ${
                                    isMap
                                      ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 text-emerald-600 dark:text-emerald-300'
                                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-blue-500/40 text-[var(--text-secondary)] hover:text-blue-500'
                                  }`}
                                  title={src.snippet || src.title}
                                >
                                  {isMap ? (
                                    <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                  ) : (
                                    <span className="font-mono-numbers text-[9px] px-1 rounded bg-black/5 dark:bg-white/10 text-[var(--text-muted)] font-bold">
                                      {sIdx + 1}
                                    </span>
                                  )}
                                  <span className="max-w-[200px] truncate font-medium">{src.title}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Action Bar for Assistant Messages */}
                      {isAssistant && (
                        <div className="flex items-center gap-3 pt-1 pl-1">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px]"
                            title="Copy message"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Copy</span>
                          </button>

                          {/* Quick Studio Generation Action Buttons */}
                          <button
                            onClick={() => handleLaunchStudioGeneration(msg.content.slice(0, 150), 'TEXT_TO_IMAGE')}
                            className="p-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-medium"
                            title="Create image from this in Studio"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Generate Image</span>
                          </button>

                          <button
                            onClick={() => handleLaunchStudioGeneration(msg.content.slice(0, 150), 'TEXT_TO_VIDEO')}
                            className="p-1 rounded-md text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-medium"
                            title="Create video from this in Studio"
                          >
                            <Film className="w-3 h-3" />
                            <span>Create Video</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Live Streaming Assistant Message */}
          {isGenerating && streamingContent && (
            <div className="flex flex-col items-start w-full">
              <div className="flex gap-3 max-w-[85%] md:max-w-[78%]">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 font-bold text-xs font-display shadow-2xs">
                  V
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="rounded-2xl p-4 text-xs leading-relaxed bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-amber-500/30 shadow-xs">
                    <div
                      className="prose prose-xs dark:prose-invert max-w-none text-xs break-words"
                      dangerouslySetInnerHTML={{ __html: marked.parse(streamingContent) as string }}
                    />
                    <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500 animate-pulse align-middle" />
                  </div>

                  {/* Streaming Sources */}
                  {streamingSources.length > 0 && (
                    <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">
                        <Globe className="w-3 h-3 animate-spin" />
                        <span>Gathering Web Sources ({streamingSources.length})...</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {streamingSources.map((src, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[10px] text-[var(--text-secondary)] border border-[var(--border-subtle)] truncate max-w-[180px]"
                          >
                            {src.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Thinking / Searching Indicator */}
          {isGenerating && !streamingContent && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] max-w-xs animate-pulse">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {webSearchEnabled ? 'Searching live web & synthesizing answers...' : 'Routing to active AI provider...'}
              </span>
            </div>
          )}

          {/* Normalized Friendly Error Banner */}
          {chatError && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2.5 max-w-md my-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{chatError.title}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {chatError.message}
              </p>
              <div className="flex items-center gap-2 pt-1">
                {chatError.retryable && (
                  <button
                    onClick={() => {
                      setChatError(null);
                      handleRegenerate();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    {chatError.actionText || 'Retry'}
                  </button>
                )}
                <button
                  onClick={() => navigate('/app/settings')}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shadow-xs"
                >
                  Provider Settings
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="p-3 md:p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] p-2.5 focus-within:border-amber-500/50 shadow-xs transition-colors"
          >
            {/* Input Text Area */}
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                webSearchEnabled
                  ? 'Ask anything with live web search grounding (e.g. latest FLUX benchmarks, prompt ideas)...'
                  : 'Message VELORA Studio Assistant (e.g. prompt tuning, camera staging, cinematography)...'
              }
              rows={2}
              className="w-full bg-transparent resize-none text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none px-2 py-1 leading-relaxed"
            />

            {/* Input Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Google Search Grounding Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !webSearchEnabled;
                    setWebSearchEnabled(next);
                    if (next) setMapsGroundingEnabled(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer select-none ${
                    webSearchEnabled
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                  }`}
                  title="Google Search Grounding (gemini-3.5-flash)"
                >
                  <Globe className={`w-3.5 h-3.5 ${webSearchEnabled ? 'text-blue-500' : ''}`} />
                  <span className="text-[11px]">Google Search</span>
                </button>

                {/* Google Maps Grounding Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !mapsGroundingEnabled;
                    setMapsGroundingEnabled(next);
                    if (next) {
                      setWebSearchEnabled(false);
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                          (err) => console.warn('Geolocation unavailable:', err)
                        );
                      }
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer select-none ${
                    mapsGroundingEnabled
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                  }`}
                  title="Google Maps Grounding (gemini-3.5-flash)"
                >
                  <MapPin className={`w-3.5 h-3.5 ${mapsGroundingEnabled ? 'text-emerald-500' : ''}`} />
                  <span className="text-[11px]">Google Maps</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Stop Generation Button if generating */}
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <>
                    {/* Regenerate Button if messages exist */}
                    {activeConv?.messages && activeConv.messages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="Regenerate response"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!inputPrompt.trim() || isGenerating}
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
