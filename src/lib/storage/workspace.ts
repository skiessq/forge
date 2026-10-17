import fs from 'fs';
import path from 'path';
import { Project } from '../types';

const WORKSPACE_DIR = path.resolve(process.cwd(), '.workspace');

export function ensureWorkspaceDir(): string {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
  return WORKSPACE_DIR;
}

export function getProjectDir(projectId: string): string {
  ensureWorkspaceDir();
  const dir = path.join(WORKSPACE_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getProjectFilePath(projectId: string): string {
  return path.join(getProjectDir(projectId), 'project.json');
}

export function listProjects(): Project[] {
  ensureWorkspaceDir();
  const entries = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true });
  const projects: Project[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const jsonPath = path.join(WORKSPACE_DIR, entry.name, 'project.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, 'utf-8');
          const p = JSON.parse(raw) as Project;
          projects.push(p);
        } catch (e) {
          console.error(`Failed to read project.json for ${entry.name}:`, e);
        }
      }
    }
  }

  // Sort by updatedAt descending
  return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getProject(projectId: string): Project | null {
  const jsonPath = getProjectFilePath(projectId);
  if (!fs.existsSync(jsonPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(raw) as Project;
  } catch (e) {
    console.error(`Error loading project ${projectId}:`, e);
    return null;
  }
}

export function saveProject(project: Project): void {
  const dir = getProjectDir(project.id);
  const jsonPath = path.join(dir, 'project.json');
  project.updatedAt = new Date().toISOString();
  fs.writeFileSync(jsonPath, JSON.stringify(project, null, 2), 'utf-8');
}

export function deleteProject(projectId: string): boolean {
  const dir = path.join(WORKSPACE_DIR, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }
  return false;
}
