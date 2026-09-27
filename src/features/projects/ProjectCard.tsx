import React, { useState } from 'react';
import { Project } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { FolderKanban, MoreVertical, Edit2, Trash2, ArrowUpRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const { navigate, renameProject, deleteProject, addToast } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const handleOpen = () => {
    navigate('/app/library');
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    renameProject(project.id, newName);
    setRenameModalOpen(false);
    addToast({
      type: 'success',
      title: 'Project Renamed',
      message: `Project updated to "${newName}".`,
    });
  };

  const handleDelete = () => {
    deleteProject(project.id);
    addToast({
      type: 'info',
      title: 'Project Removed',
      message: `"${project.name}" has been deleted.`,
    });
  };

  return (
    <>
      <div className="group relative flex flex-col rounded-2xl bg-[#0F121C] border border-white/10 hover:border-amber-500/30 transition-all duration-200 overflow-hidden select-none shadow-sm">
        {/* Project Cover Canvas */}
        <div 
          onClick={handleOpen}
          className={`w-full h-32 bg-gradient-to-br ${project.coverGradient} relative p-4 flex flex-col justify-between cursor-pointer overflow-hidden`}
        >
          <div className="flex items-center justify-between z-10">
            <div className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white">
              <FolderKanban className="w-4 h-4" />
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1 rounded-lg bg-black/40 text-slate-300 hover:text-white backdrop-blur-md transition-colors cursor-pointer"
                aria-label="Project actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div 
                  className="absolute right-0 top-8 z-30 w-36 bg-[#161924] border border-white/10 rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setRenameModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDelete();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-numbers text-slate-300 z-10">
            <span>{project.assetCount} Assets</span>
            <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-amber-300">
              Open <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Project Details */}
        <div onClick={handleOpen} className="p-4 flex flex-col gap-1 cursor-pointer">
          <h4 className="text-sm font-semibold text-white tracking-tight group-hover:text-amber-300 transition-colors truncate">
            {project.name}
          </h4>
          <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed">
            {project.description}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2 font-mono-numbers">
            <span>Updated {project.updatedAt}</span>
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      <Modal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename Project"
      >
        <form onSubmit={handleRename} className="flex flex-col gap-4">
          <Input
            label="Project Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new project title"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenameModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Title
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export const CreateProjectModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { createProject, addToast } = useAppStore();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProject(name, desc);
    onClose();
    setName('');
    setDesc('');
    addToast({
      type: 'success',
      title: 'Project Created',
      message: `"${name}" added to your workspace.`,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      description="Organize your AI generated shots, video iterations, and moodboards."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Autumn Fashion Campaign"
          required
          autoFocus
        />
        <Input
          label="Description (Optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. Concept video scenes and photorealistic portraits"
        />
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};
