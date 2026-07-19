import useSWR, { mutate } from 'swr';
import { projectsApi, Project, ProjectSummary } from './projects';
import { workspaceDocsApi, WorkspaceDocListItem } from './workspace-docs';
import { workspaceWhiteboardsApi, WhiteboardListItem } from './workspace-whiteboards';

const STALE_MS = 60_000;

export type WorkspaceDocListParams = {
  project?: number;
  workspace_only?: boolean;
  starred?: boolean;
  q?: string;
};

function workspaceDocsKey(params?: WorkspaceDocListParams) {
  return [
    'workspace-docs',
    params?.project ?? null,
    params?.workspace_only ?? false,
    params?.starred ?? false,
    params?.q ?? '',
  ] as const;
}

export function useProjectSummaries() {
  return useSWR<ProjectSummary[]>('project-summaries', () => projectsApi.getProjectSummaries(), {
    dedupingInterval: STALE_MS,
    revalidateOnFocus: false,
  });
}

export function useProjects() {
  return useSWR<Project[]>('projects', () => projectsApi.getProjects(), {
    dedupingInterval: STALE_MS,
    revalidateOnFocus: false,
  });
}

export function useWorkspaceDocs(params?: WorkspaceDocListParams) {
  return useSWR<WorkspaceDocListItem[]>(
    workspaceDocsKey(params),
    () => workspaceDocsApi.list(params),
    {
      dedupingInterval: STALE_MS,
      revalidateOnFocus: false,
    },
  );
}

export function invalidateWorkspaceDocs() {
  void mutate((key) => Array.isArray(key) && key[0] === 'workspace-docs');
}

export function invalidateProjects() {
  void mutate('projects');
  void mutate('project-summaries');
}

export type WorkspaceWhiteboardListParams = {
  project?: number;
  workspace_only?: boolean;
  q?: string;
};

function workspaceWhiteboardsKey(params?: WorkspaceWhiteboardListParams) {
  return [
    'workspace-whiteboards',
    params?.project ?? null,
    params?.workspace_only ?? false,
    params?.q ?? '',
  ] as const;
}

export function useWorkspaceWhiteboards(params?: WorkspaceWhiteboardListParams) {
  return useSWR<WhiteboardListItem[]>(
    workspaceWhiteboardsKey(params),
    () => workspaceWhiteboardsApi.list(params),
    {
      dedupingInterval: STALE_MS,
      revalidateOnFocus: false,
    },
  );
}

export function invalidateWorkspaceWhiteboards() {
  void mutate((key) => Array.isArray(key) && key[0] === 'workspace-whiteboards');
}
