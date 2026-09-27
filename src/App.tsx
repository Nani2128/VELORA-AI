import React, { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { AppShell } from './components/layout/AppShell';

// Pages
import { LandingPage } from './pages/LandingPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { ShowcasePage } from './pages/ShowcasePage';
import { PricingPage } from './pages/PricingPage';
import { LoginPage, SignupPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreatePage } from './pages/CreatePage';
import { ImageGeneratorPage } from './pages/ImageGeneratorPage';
import { VideoGeneratorPage } from './pages/VideoGeneratorPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { LibraryPage } from './pages/LibraryPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { MusicGeneratorPage } from './pages/MusicGeneratorPage';
import { AudioTranscribePage } from './pages/AudioTranscribePage';

export default function App() {
  const { currentPath, theme, loadProjects, loadLibrary, loadHistory, loadModels } = useAppStore();

  // Apply active theme (White-first Light mode by default)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load persistent backend collections and model registry on mount
  useEffect(() => {
    loadProjects();
    loadLibrary();
    loadHistory();
    loadModels();
  }, [loadProjects, loadLibrary, loadHistory, loadModels]);

  // Synchronize browser history (popstate / back & forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/';
      useAppStore.setState({ currentPath: path });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Route Resolver
  const renderCurrentPage = () => {
    switch (currentPath) {
      // Public marketing & auth
      case '/':
        return <LandingPage />;
      case '/features':
        return <FeaturesPage />;
      case '/showcase':
        return <ShowcasePage />;
      case '/pricing':
        return <PricingPage />;
      case '/login':
        return <LoginPage />;
      case '/signup':
        return <SignupPage />;

      // Studio Application
      case '/app':
        return <DashboardPage />;
      case '/app/chat':
        return <ChatPage />;
      case '/app/create':
        return <CreatePage />;
      case '/app/image':
        return <ImageGeneratorPage />;
      case '/app/video':
        return <VideoGeneratorPage />;
      case '/app/music':
        return <MusicGeneratorPage />;
      case '/app/transcribe':
        return <AudioTranscribePage />;
      case '/app/projects':
        return <ProjectsPage />;
      case '/app/library':
        return <LibraryPage />;
      case '/app/history':
        return <HistoryPage />;
      case '/app/settings':
        return <SettingsPage />;

      // Fallback
      default:
        return <LandingPage />;
    }
  };

  return (
    <AppShell>
      {renderCurrentPage()}
    </AppShell>
  );
}
