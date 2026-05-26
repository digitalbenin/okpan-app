import { executeQuery } from '$lib/api/graphqlClient.js';

export const getProjectActivity = async (projectId, limit = 10) => {
    const result = await executeQuery('project_activity', 'list', { projectId, limit });

    if (result) {
        return {
            items: result || [],
            totalCount: result.length || 0
        };
    }

    return {
        items: [],
        totalCount: 0,
        error: result?.error || new Error('Failed to fetch project activity')
    };
};