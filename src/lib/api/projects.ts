import { apiFetch } from './client';

export interface ProjectData {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_asset_id: string | null;
  created_at: string;
  updated_at: string;
  asset_count: number;
}

export async function fetchProjects(): Promise<ProjectData[]> {
  return apiFetch<ProjectData[]>('/api/v1/projects');
}

export async function fetchProject(id: string): Promise<ProjectData> {
  return apiFetch<ProjectData>(`/api/v1/projects/${id}`);
}

export async function createProject(name: string, description?: string): Promise<ProjectData> {
  return apiFetch<ProjectData>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function updateProject(id: string, update: { name?: string; description?: string; cover_asset_id?: string }): Promise<ProjectData> {
  return apiFetch<ProjectData>(`/api/v1/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export async function deleteProject(id: string): Promise<{ success: boolean; deleted_id: string }> {
  return apiFetch<{ success: boolean; deleted_id: string }>(`/api/v1/projects/${id}`, {
    method: 'DELETE',
  });
}
