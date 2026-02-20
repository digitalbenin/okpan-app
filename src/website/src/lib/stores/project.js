import { writable } from 'svelte/store';

/**
 * Persists the current project_id across client-side navigation.
 * Initialized from the URL in +layout.svelte and preserved via localStorage.
 */
export const currentProjectId = writable(null);
