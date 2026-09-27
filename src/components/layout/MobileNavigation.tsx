import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { LayoutDashboard, Sparkles, MessageSquare, FolderKanban, Library, Settings } from 'lucide-react';

export const MobileNavigation: React.FC = () => {
  const { currentPath, navigate } = useAppStore();

  const isPublicPage = ['/', '/features', '/showcase', '/pricing', '/login', '/signup'].includes(currentPath);

  if (isPublicPage) return null;

  const items = [
    { path: '/app', label: 'Studio', icon: LayoutDashboard },
    { path: '/app/chat', label: 'AI Chat', icon: MessageSquare },
    { path: '/app/create', label: 'Create', icon: Sparkles, highlight: true },
    { path: '/app/projects', label: 'Projects', icon: FolderKanban },
    { path: '/app/library', label: 'Library', icon: Library },
    { path: '/app/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-sidebar)]/95 backdrop-blur-lg border-t border-[var(--border-subtle)] px-2 py-1.5 flex items-center justify-around h-16 shadow-2xl transition-colors"
    >
      {items.map((item) => {
        const isActive = currentPath === item.path;
        const Icon = item.icon;

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[44px] rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'text-amber-500 font-medium'
                : 'text-slate-500 hover:text-[var(--text-primary)]'
            }`}
          >
            <div className={`p-1 rounded-lg ${isActive ? 'bg-amber-500/15' : ''}`}>
              <Icon className={`w-5 h-5 ${item.highlight && isActive ? 'text-amber-500' : ''}`} />
            </div>
            <span className="text-[10px] tracking-tight leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
