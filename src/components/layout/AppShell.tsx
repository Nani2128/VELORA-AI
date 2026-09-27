import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';
import { ToastContainer } from '../ui/ToastContainer';
import { CustomCursor } from '../cursor/CustomCursor';
import { LiveVoiceModal } from '../studio/LiveVoiceModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { currentPath, isLiveVoiceOpen, setIsLiveVoiceOpen } = useAppStore();
  const isPublicPage = ['/', '/features', '/showcase', '/pricing', '/login', '/signup'].includes(currentPath);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col antialiased transition-colors duration-200">
      <CustomCursor />
      
      {isPublicPage ? (
        // Public marketing pages layout
        <div className="flex flex-col min-h-screen">
          <Topbar />
          <main className="flex-1 w-full">
            {children}
          </main>
        </div>
      ) : (
        // Studio Application Layout
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto pb-20 md:pb-6 p-4 md:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto w-full">
                {children}
              </div>
            </main>
          </div>
          <MobileNavigation />
        </div>
      )}

      {/* Real-time Voice Conversations with gemini-3.8-live */}
      <LiveVoiceModal
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
      />

      <ToastContainer />
    </div>
  );
};
