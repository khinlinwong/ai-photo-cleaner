import { LocalProjectSummary, LocalProjectFileFingerprint } from './types';

const STORAGE_KEY = 'ai-photo-cleaner:recent-projects';
const RECENT_PROJECTS_LIMIT = 6;

export function createProjectId(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createFileFingerprints(files: File[]): LocalProjectFileFingerprint[] {
  return Array.from(files).map(file => ({
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    type: file.type
  }));
}

export function getRecentLocalProjects(): LocalProjectSummary[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('[ProjectStorage] Failed to parse recent projects from localStorage:', err);
    return [];
  }
}

export function saveRecentLocalProject(summary: LocalProjectSummary): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const current = getRecentLocalProjects();
    const next = [
      summary,
      ...current.filter(item => item.projectId !== summary.projectId)
    ].slice(0, RECENT_PROJECTS_LIMIT);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[ProjectStorage] Failed to save project to localStorage:', err);
  }
}

export function clearRecentLocalProjects(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[ProjectStorage] Failed to clear recent projects from localStorage:', err);
  }
}

export function removeLocalProjectSummary(projectId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const current = getRecentLocalProjects();
    const next = current.filter(item => item.projectId !== projectId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[ProjectStorage] Failed to remove project from localStorage:', err);
  }
}
