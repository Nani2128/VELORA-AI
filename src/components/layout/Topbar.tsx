import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { BrandLogo } from '../common/BrandLogo';
import { Button } from '../ui/Button';
import { Volume2, VolumeX, Sparkles, ChevronRight, Menu, Sun, Moon, Radio } from 'lucide-react';

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileMenu }) => {
  const { 
    currentPath, 
    navigate, 
    user, 
    soundEnabled, 
    setSoundEnabled,
    sidebarCollapsed,
    setSidebarCollapsed,
    theme,
    toggleTheme,
    setIsLiveVoiceOpen
  } = useAppStore();

  const isPublicPage = ['/', '/features', '/showcase', '/pricing', '/login', '/signup'].includes(currentPath);

  // Path breadcrumb resolution for App routes
  const getBreadcrumb = () => {
    switch (currentPath) {
      case '/app':
        return 'Overview';
      case '/app/chat':
        return 'AI Chat & Web Search';
      case '/app/create':
        return 'Creative Studio';
      case '/app/image':
        return 'Image Synthesizer';
      case '/app/video':
        return 'Video Synthesizer';
      case '/app/projects':
        return 'Projects';
      case '/app/library':
        return 'Media Library';
      case '/app/history':
        return 'Generation Activity';
      case '/app/settings':
        return 'Preferences';
      default:
        return 'Studio';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 md:px-6 flex items-center justify-between transition-colors">
      {/* Zone 1: Brand / Context */}
      <div className="flex items-center gap-4">
        {!isPublicPage && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-2 text-slate-500 hover:text-[var(--text-primary)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {isPublicPage ? (
          <div onClick={() => navigate('/')} className="cursor-pointer">
            <BrandLogo size="md" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <div onClick={() => navigate('/app')} className="cursor-pointer flex items-center">
              <span className="font-display font-bold text-[var(--text-primary)] text-base tracking-wide hover:text-amber-500 transition-colors">
                VELORA
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="font-medium text-slate-600 dark:text-slate-300 text-xs md:text-sm">
              {getBreadcrumb()}
            </span>
          </div>
        )}
      </div>

      {/* Zone 2: Navigation Links */}
      {isPublicPage ? (
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => navigate('/')}
            className={`hover:text-[var(--text-primary)] transition-colors cursor-pointer ${
              currentPath === '/' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
            }`}
          >
            Studio
          </button>
          <button
            onClick={() => navigate('/features')}
            className={`hover:text-[var(--text-primary)] transition-colors cursor-pointer ${
              currentPath === '/features' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
            }`}
          >
            Capabilities
          </button>
          <button
            onClick={() => navigate('/showcase')}
            className={`hover:text-[var(--text-primary)] transition-colors cursor-pointer ${
              currentPath === '/showcase' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
            }`}
          >
            Showcase
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className={`hover:text-[var(--text-primary)] transition-colors cursor-pointer ${
              currentPath === '/pricing' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
            }`}
          >
            Plans
          </button>
        </nav>
      ) : (
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono-numbers text-slate-500 dark:text-slate-400 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Studio Engine Ready</span>
        </div>
      )}

      {/* Zone 3: Actions & Controls */}
      <div className="flex items-center gap-2.5">
        {/* Gemini Live Voice Conversation Trigger */}
        <button
          onClick={() => setIsLiveVoiceOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 transition-all cursor-pointer shadow-2xs group"
          title="Start real-time voice conversation with Gemini 3.8 Live"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse text-amber-500" />
          <span className="text-xs font-semibold hidden sm:inline">Live Voice</span>
        </button>

        {/* Instant Theme Toggle (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-2xs"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode (White-first)'}
          aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-700" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-500 hover:text-[var(--text-primary)]'
          }`}
          title={soundEnabled ? 'Audio feedback enabled' : 'Audio feedback muted'}
          aria-label={soundEnabled ? 'Mute audio' : 'Unmute audio'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {isPublicPage ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-xs hidden sm:inline-flex"
            >
              Sign In
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/create')}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Start Creating
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/create')}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              className="text-xs hidden sm:inline-flex"
            >
              New Creation
            </Button>

            {/* User profile avatar */}
            <div 
              onClick={() => navigate('/app/settings')}
              className="flex items-center gap-2 pl-1 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-xs text-slate-950 shadow-sm border border-amber-400/30 group-hover:scale-105 transition-transform">
                {user.avatarInitials}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
