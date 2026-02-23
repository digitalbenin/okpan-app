import { browser } from '$app/environment';

const PROJECT_STORAGE_KEY = 'website-preview.active-project-id';

const normalizeProjectId = (projectId) => {
    if (typeof projectId !== 'string') return null;
    const trimmed = projectId.trim();
    return trimmed ? trimmed : null;
};

export const getProjectIdFromUrl = (url) => {
    const projectId = url?.searchParams?.get('project_id');
    return normalizeProjectId(projectId);
};

export const getStoredProjectId = () => {
    if (!browser) return null;

    try {
        return normalizeProjectId(window.localStorage.getItem(PROJECT_STORAGE_KEY));
    } catch {
        return null;
    }
};

export const setStoredProjectId = (projectId) => {
    if (!browser) return;

    const normalized = normalizeProjectId(projectId);

    try {
        if (normalized) {
            window.localStorage.setItem(PROJECT_STORAGE_KEY, normalized);
        } else {
            window.localStorage.removeItem(PROJECT_STORAGE_KEY);
        }
    } catch {
        // Ignore storage write errors (private mode, disabled storage, etc.)
    }
};

export const resolveProjectId = (url) => {
    const fromUrl = getProjectIdFromUrl(url);
    if (fromUrl) {
        setStoredProjectId(fromUrl);
        return fromUrl;
    }

    return getStoredProjectId();
};

export const buildPathWithProjectId = (path, projectId) => {
    const normalized = normalizeProjectId(projectId);
    if (!normalized) return path;

    const parsedUrl = new URL(path, 'http://local');
    parsedUrl.searchParams.set('project_id', normalized);

    const query = parsedUrl.searchParams.toString();
    return `${parsedUrl.pathname}${query ? `?${query}` : ''}${parsedUrl.hash}`;
};