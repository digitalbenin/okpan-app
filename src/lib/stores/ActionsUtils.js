import { executeQuery } from './GraphqlUtils.js';

// Main actions query (includes all actions)
export const getActions = async (options = {}) => {
    const result = await executeQuery('actions', 'listVisualizableActions', options);
    if (result && result.result) {
        return { items: result.result || [], totalCount: result.result.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch actions or unexpected response structure") };

};

// Get only parent actions (those exposed to users) - default behavior for UI
export const getParentActions = async (params = {}) => {
    return executeQuery('actions', 'listVisualizableActions', params);
};

// Convenience functions for common use cases - all use parent actions by default
export const getActionsForEntity = async (primaryEntityType, primaryEntityId, limit = 10) => {
    return getParentActions({ entityType: primaryEntityType, entityId: primaryEntityId, limit });
};

export const getRecentActions = async (projectId = null, limit = 20) => {
    return getParentActions({ projectId, limit });
};

export const getActionsByUser = async (userId, options = {}) => {
    const { projectId = null, limit = 50, offset = 0 } = options;
    return getParentActions({ userId, projectId, limit, offset });
};

// Get child actions for a specific parent action
export const getChildActions = async (parentActionId, limit = 50) => {
    return getActions({ parentActionId, limit });
}; 
