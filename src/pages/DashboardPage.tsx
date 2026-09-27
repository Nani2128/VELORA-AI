import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Button } from '../components/ui/Button';
import { MediaCard } from '../features/library/MediaCard';
import { ProjectCard } from '../features/projects/ProjectCard';
import { 
  Sparkles, 
  Film, 
  Image as ImageIcon, 
  Wand2, 
  ArrowRight, 
  FolderKanban, 
  Clock, 
  Plus 
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { 
    user, 
    navigate, 
    setGenerationType, 
    setIsLiveVoiceOpen,
    assets, 
    projects, 
    history 
  } = useAppStore();

  const quickActions = [
    {
      title: 'Create & Edit Images',
      desc: 'gemini-3.1-flash-image-preview',
      onClick: () => {
        setGenerationType('TEXT_TO_IMAGE');
        navigate('/app/image');
      },
      icon: ImageIcon,
      color: 'text-amber-500',
      badge: 'Image',
    },
    {
      title: 'Veo Video Studio',
      desc: 'veo-3.1-fast-generate-preview (16:9 / 9:16)',
      onClick: () => {
        setGenerationType('IMAGE_TO_VIDEO');
        navigate('/app/video');
      },
      icon: Film,
      color: 'text-purple-500',
      badge: 'Veo 3.1',
    },
    {
      title: 'Lyria Music Studio',
      desc: 'lyria-3-clip-preview & lyria-3-pro-preview',
      onClick: () => {
        navigate('/app/music');
      },
      icon: Film,
      color: 'text-cyan-500',
      badge: 'Music',
    },
    {
      title: 'Audio Transcriber',
      desc: 'Microphone speech via gemini-3.5-transcribe',
      onClick: () => {
        navigate('/app/transcribe');
      },
      icon: Sparkles,
      color: 'text-emerald-500',
      badge: 'Speech',
    },
    {
      title: 'Gemini Live Voice',
      desc: 'Real-time 2-way audio via gemini-3.8-live',
      onClick: () => {
        setIsLiveVoiceOpen(true);
      },
      icon: Sparkles,
      color: 'text-rose-500',
      badge: 'Live API',
    },
    {
      title: 'AI Search & Maps',
      desc: 'Grounding via gemini-3.5-flash',
      onClick: () => {
        navigate('/app/chat');
      },
      icon: Wand2,
      color: 'text-blue-500',
      badge: 'Grounding',
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Welcome & Quota Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono-numbers">
            Studio Session Active
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
            Welcome back, {user.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Direct your creative pipeline or continue working on ongoing projects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="md"
            variant="primary"
            onClick={() => {
              setGenerationType('TEXT_TO_VIDEO');
              navigate('/app/video');
            }}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Create New Shot
          </Button>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Quick Studio Actions
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                onClick={action.onClick}
                className="flex items-start gap-3.5 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-500/30 hover:bg-[var(--bg-surface-elevated)] text-left transition-all duration-150 cursor-pointer group shadow-xs"
              >
                <div className={`p-2.5 rounded-xl bg-black/5 dark:bg-white/5 group-hover:bg-amber-500/10 ${action.color} shrink-0 transition-colors`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-amber-500 transition-colors truncate">
                      {action.title}
                    </span>
                    <span className="text-[10px] font-mono-numbers px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 font-semibold shrink-0">
                      {action.badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                    {action.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Studio Creations */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recent Creations
          </span>
          <button
            onClick={() => navigate('/app/library')}
            className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>View Library ({assets.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.slice(0, 3).map((asset) => (
            <MediaCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>

      {/* Active Projects */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Production Projects
          </span>
          <button
            onClick={() => navigate('/app/projects')}
            className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>All Projects ({projects.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.slice(0, 3).map((proj) => (
            <ProjectCard key={proj.id} project={proj} />
          ))}
        </div>
      </div>

      {/* Recent Activity Mini-Feed */}
      {history.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Activity Feed</span>
            </span>
            <button
              onClick={() => navigate('/app/history')}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              See all activity
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {history.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('/app/history')}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0F121C] border border-white/5 hover:border-white/10 transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-slate-200 font-medium truncate">"{item.prompt}"</span>
                </div>
                <span className="text-[11px] font-mono-numbers text-slate-400 shrink-0">
                  {item.createdAt}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
