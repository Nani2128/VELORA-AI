import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { ProjectCard, CreateProjectModal } from '../features/projects/ProjectCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/common/EmptyState';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { Input } from '../components/ui/Input';

export const ProjectsPage: React.FC = () => {
  const { projects, loadProjects } = useAppStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono-numbers">
            Production Management
          </span>
          <h1 className="text-2xl font-display font-extrabold text-white mt-0.5">
            Projects & Collections
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Group scenes, video variations, and creative moodboards into production projects.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => setCreateModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Project
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <span className="text-xs font-mono-numbers text-slate-400 shrink-0">
          {filteredProjects.length} of {projects.length} Projects
        </span>
      </div>

      {/* Projects Grid or Empty State */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-6 h-6" />}
          title={search ? 'No projects match your search' : 'No projects created yet'}
          description={
            search
              ? 'Try modifying your search term or clear the filter to view all collections.'
              : 'Create your first creative project to organize generated visual assets and shot sequences.'
          }
          actionLabel="Create Project"
          onAction={() => setCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
};
