import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { BrandLogo } from '../common/BrandLogo';
import { 
  LayoutDashboard, 
  Sparkles, 
  MessageSquare,
  Image as ImageIcon, 
  Film, 
  Music,
  Mic,
  Radio,
  FolderKanban, 
  Library, 
  Clock, 
  Settings, 
  ExternalLink,
  ChevronLeft
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentPath, navigate, sidebarCollapsed, setSidebarCollapsed, user, setIsLiveVoiceOpen } = useAppStore();

  const navItems = [
    { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/chat', label: 'AI Chat & Grounding', icon: MessageSquare, highlight: true },
    { path: '/app/create', label: 'Create Studio', icon: Sparkles },
    { path: '/app/image', label: 'Image Synthesizer', icon: ImageIcon },
    { path: '/app/video', label: 'Veo Video Studio', icon: Film },
    { path: '/app/music', label: 'Music Synthesizer', icon: Music, badge: 'Lyria' },
    { path: '/app/transcribe', label: 'Audio Transcriber', icon: Mic, badge: 'Speech' },
    { path: '/app/projects', label: 'Projects', icon: FolderKanban },
    { path: '/app/library', label: 'Media Library', icon: Library },
    { path: '/app/history', label: 'History & Logs', icon: Clock },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] transition-all duration-300 select-none z-30 ${
        sidebarCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-subtle)]">
        {!sidebarCollapsed ? (
          <div onClick={() => navigate('/app')} className="cursor-pointer">
            <BrandLogo size="sm" />
          </div>
        ) : (
          <div onClick={() => navigate('/app')} className="cursor-pointer mx-auto">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center font-bold text-slate-950 text-xs shadow-md">
              V
            </div>
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
            sidebarCollapsed ? 'hidden' : 'flex'
          }`}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Main navigation */}
      <div className="flex-1 py-4 px-2.5 flex flex-col gap-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">
          {!sidebarCollapsed && 'Studio'}
        </div>
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/[0.04]'
              } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-400'}`} />
              {!sidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
              {!sidebarCollapsed && item.badge && (
                <span className="ml-auto text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/20">
                  {item.badge}
                </span>
              )}
              {!sidebarCollapsed && item.highlight && (
                <span className="ml-auto text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-semibold">
                  NEW
                </span>
              )}
            </button>
          );
        })}

        {/* Gemini Live Voice Quick Trigger */}
        <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => setIsLiveVoiceOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 ${
              sidebarCollapsed ? 'justify-center px-2' : ''
            }`}
            title="Launch Gemini 3.8 Live Voice Studio"
          >
            <Radio className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="truncate">Live Voice Studio</span>
                <span className="ml-auto text-[9px] font-mono-numbers px-1.5 py-0.5 rounded-full bg-amber-500/20 font-bold">
                  3.8 Live
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* User & Settings footer */}
      <div className="p-3 border-t border-[var(--border-subtle)] flex flex-col gap-2">
        <button
          onClick={() => navigate('/app/settings')}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/[0.04] transition-colors cursor-pointer ${
            currentPath === '/app/settings' ? 'bg-black/5 dark:bg-white/[0.06] font-semibold text-slate-900 dark:text-white' : ''
          } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 shrink-0 text-slate-400" />
          {!sidebarCollapsed && <span className="truncate">Settings</span>}
        </button>

        {!sidebarCollapsed && (
          <div className="mt-1 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user.tier}</span>
              <span className="font-mono-numbers text-amber-600 dark:text-amber-400 text-[11px] font-bold">850 / 1000</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full w-[85%]" />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
              <span>Studio Credits</span>
              <button
                onClick={() => navigate('/pricing')}
                className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer font-medium"
              >
                Upgrade <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
