import { executeQuery } from '$lib/api/graphqlClient.js';

/**
 * @namespace frontend.api.ProjectActivityApi
 */

/**
 * Returns recent activity entries for a project.
 * @memberOf frontend.api.ProjectActivityApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {number} [limit=10] - Maximum number of activity entries to return.
 * @returns {Promise.<{items: Array.<Object>, totalCount: number, error: (Error|undefined)}>} Paginated activity list.
 */
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