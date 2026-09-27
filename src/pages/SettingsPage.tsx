import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Slider';
import { Button } from '../components/ui/Button';
import { fetchProvidersHealth, fetchProvidersDashboard, ProviderDashboardItem } from '../lib/api/models';
import { ProviderHealth } from '../types';
import { 
  User, 
  Volume2, 
  Eye, 
  Bell, 
  Sun, 
  Moon, 
  Server, 
  Check, 
  AlertCircle,
  Cpu,
  RefreshCw,
  Zap,
  ShieldCheck,
  Activity,
  Layers,
  Database
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { 
    user, 
    soundEnabled, 
    setSoundEnabled, 
    reducedMotion, 
    setReducedMotion, 
    theme, 
    setTheme,
    addToast 
  } = useAppStore();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [notifications, setNotifications] = useState(true);
  const [highQualityPreview, setHighQualityPreview] = useState(true);
  const [providersHealth, setProvidersHealth] = useState<ProviderHealth[]>([]);
  const [dashboardProviders, setDashboardProviders] = useState<ProviderDashboardItem[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const loadProviderMesh = async () => {
    setLoadingHealth(true);
    try {
      const [health, dashboard] = await Promise.all([
        fetchProvidersHealth().catch(() => []),
        fetchProvidersDashboard().catch(() => []),
      ]);
      setProvidersHealth(health);
      setDashboardProviders(dashboard);
    } catch (err) {
      console.warn('Could not load health:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    loadProviderMesh();
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Preferences Saved',
      message: 'Studio settings updated successfully.',
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider font-mono-numbers">
          Studio Preferences
        </span>
        <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mt-0.5">
          Settings & Environment
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Manage your creative profile, theme mode, model engines, and sensory feedback.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Theme Switching (White-first vs Dark) */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-4 shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Studio Visual Theme</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Select your preferred visual atmosphere. VELORA AI features a white-first luminous light mode and a deep cinematic obsidian dark mode.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md pt-1">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                theme === 'light'
                  ? 'border-amber-500 bg-amber-500/10 text-slate-950 font-bold shadow-xs'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-overlay)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
                <Sun className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--text-primary)]">Light Mode (White-first)</span>
                <span className="text-[11px] text-[var(--text-muted)]">Clean, elevated, high contrast</span>
              </div>
              {theme === 'light' && <Check className="w-4 h-4 text-amber-500 ml-auto" />}
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-amber-500 bg-amber-500/10 text-white font-bold shadow-xs'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-overlay)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400">
                <Moon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[var(--text-primary)]">Dark Mode</span>
                <span className="text-[11px] text-[var(--text-muted)]">Obsidian night canvas</span>
              </div>
              {theme === 'dark' && <Check className="w-4 h-4 text-amber-500 ml-auto" />}
            </button>
          </div>
        </section>

        {/* Model Providers & System Health */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-primary)]">
              <Server className="w-4 h-4 text-amber-500" />
              <span>AI Provider & Model Engine Status</span>
            </div>
            <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              Phase 03 Registry
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {providersHealth.map((provider) => {
              const isHealthy = provider.status === 'healthy';
              return (
                <div
                  key={provider.id}
                  className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{provider.name}</span>
                    <span
                      className={`text-[10px] font-mono-numbers px-1.5 py-0.2 rounded font-medium flex items-center gap-1 ${
                        isHealthy
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {provider.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                    {provider.message || 'Provider operational.'}
                  </p>
                  <div className="text-[10px] font-mono-numbers text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)] truncate">
                    Models: {provider.models?.join(', ') || 'N/A'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Profile Card */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-6 shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <User className="w-4 h-4 text-amber-500" />
            <span>Studio Identity & Tier</span>
          </div>

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 max-w-xl">
            <div className="flex items-center gap-4 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-base text-slate-950 shadow-md border border-amber-400/30 shrink-0">
                {user.avatarInitials}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--text-primary)]">{user.name}</span>
                <span className="text-xs text-amber-500 font-medium">{user.tier} · 850 Credits Remaining</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Display Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex justify-start pt-2">
              <Button type="submit" size="sm">
                Save Profile
              </Button>
            </div>
          </form>
        </section>

        {/* Sensory Sound & Haptics Section */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <Volume2 className="w-4 h-4 text-amber-500" />
            <span>Audio & Tactile Feedback</span>
          </div>

          <div className="flex flex-col gap-4 max-w-xl">
            <Switch
              checked={soundEnabled}
              onChange={setSoundEnabled}
              label="Synthesizer Sound Effects"
              description="Play subtle, harmonic chimes on studio button clicks, pipeline queuing, and render completions."
            />
          </div>
        </section>

        {/* Appearance & Motion Section */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <Eye className="w-4 h-4 text-amber-500" />
            <span>Motion & Rendering Experience</span>
          </div>

          <div className="flex flex-col gap-4 max-w-xl">
            <Switch
              checked={reducedMotion}
              onChange={setReducedMotion}
              label="Reduce Motion Transitions"
              description="Disable background pulsing, floating ambient fields, and zoom micro-interactions across the studio UI."
            />

            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <Switch
                checked={highQualityPreview}
                onChange={setHighQualityPreview}
                label="High-Bitrate Viewport Scrubbing"
                description="Prioritize smooth 60fps playback buffering when scrubbing temporal video latents."
              />
            </div>
          </div>
        </section>

        {/* Notifications & Privacy */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-primary)]">
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Alerts & Notifications</span>
          </div>

          <div className="flex flex-col gap-4 max-w-xl">
            <Switch
              checked={notifications}
              onChange={setNotifications}
              label="In-App Queue Notifications"
              description="Show subtle toast banners when a multi-second video sequence completes in the background."
            />
          </div>
        </section>

        {/* Multi-Provider AI Orchestration Mesh */}
        <section className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Multi-Provider AI Orchestration Mesh
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Real-time health, auto-fallback routing, and quota awareness across all 10 engine providers.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadProviderMesh}
              disabled={loadingHealth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-overlay)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${loadingHealth ? 'animate-spin' : ''}`} />
              <span>{loadingHealth ? 'Probing...' : 'Refresh Mesh'}</span>
            </button>
          </div>

          {/* Grid of Providers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {dashboardProviders.length === 0 ? (
              <div className="col-span-2 p-6 text-center text-xs text-[var(--text-muted)]">
                {loadingHealth ? 'Scanning AI provider endpoints...' : 'No provider diagnostics currently registered.'}
              </div>
            ) : (
              dashboardProviders.map((prov) => {
                const isHealthy = prov.status === 'AVAILABLE' || prov.status === 'HEALTHY';
                const isRateLimited = prov.status === 'RATE_LIMITED' || prov.status === 'QUOTA_EXHAUSTED' || prov.status === 'DEGRADED';
                const isAuthError = prov.status === 'AUTH_ERROR';

                let statusBadge = (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-mono-numbers font-bold bg-slate-100 dark:bg-white/10 text-slate-500">
                    NOT CONFIGURED
                  </span>
                );

                if (isHealthy) {
                  statusBadge = (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono-numbers font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ● AVAILABLE
                    </span>
                  );
                } else if (isRateLimited) {
                  statusBadge = (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono-numbers font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                      ▲ RATE LIMITED
                    </span>
                  );
                } else if (isAuthError) {
                  statusBadge = (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono-numbers font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      ✕ AUTH ERROR
                    </span>
                  );
                }

                let costBadge = (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                    {prov.costClass.replace('_', ' ')}
                  </span>
                );

                if (prov.costClass === 'LOCAL') {
                  costBadge = (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                      LOCAL / UNMETERED
                    </span>
                  );
                } else if (prov.costClass === 'FREE_ALLOWANCE') {
                  costBadge = (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                      FREE TIER
                    </span>
                  );
                }

                return (
                  <div
                    key={prov.id}
                    className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex flex-col justify-between gap-3 shadow-2xs hover:border-amber-500/20 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {prov.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-white/5 text-[var(--text-muted)] font-mono uppercase">
                            {prov.category}
                          </span>
                        </div>
                        {statusBadge}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        {costBadge}
                        {prov.latencyMs !== undefined && prov.latencyMs > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            ⚡ {prov.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-1">
                      {prov.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
                        >
                          {cap.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
