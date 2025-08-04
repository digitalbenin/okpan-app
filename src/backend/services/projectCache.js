// Simple in-memory project ID cache for single-user Electron app
let currentProjectId = null;

/**
 * Set the current project ID
 * @param {string} projectId - The project ID to cache
 */
export const setCurrentProjectId = (projectId) => {
    currentProjectId = projectId;
    console.log(`Project ID cached: ${projectId}`);
};

/**
 * Get the current cached project ID
 * @returns {string|null} The cached project ID or null if not set
 */
export const getCurrentProjectId = () => {
    return currentProjectId;
};

/**
 * Clear the cached project ID
 */
export const clearCurrentProjectId = () => {
    currentProjectId = null;
    console.log('Project ID cache cleared');
};

/**
 * Check if a project ID is currently cached
 * @returns {boolean} True if a project ID is cached
 */
export const hasCurrentProjectId = () => {
    return currentProjectId !== null;
};