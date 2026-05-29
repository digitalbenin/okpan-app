import { executeQuery } from "$lib/api/graphqlClient.js";

/**
 * @namespace frontend.api.SearchApi
 */

/**
 * Performs a full-text search across multiple entity types within a project.
 * @memberOf frontend.api.SearchApi
 * @method
 * @param {Object} options - Search options.
 * @param {string} [options.query=''] - Search query string.
 * @param {string} options.projectId - The project ID to scope the search.
 * @param {Array.<string>} [options.entityTypes] - Entity types to include in results.
 * @param {number} [options.pageSize] - Maximum number of results.
 * @param {number} [options.limit] - Alias for pageSize.
 * @returns {Promise.<{items: Array.<Object>, totalCount: number, error: (Error|undefined)}>}
 */
export const getSearch = async (options) => {
    // Entity search requires a query parameter, use empty string if not provided
    const searchOptions = {
        query: options.query || "", // Required parameter
        projectId: options.projectId,
        // Let server decide default types when not provided; allow explicit overrides
        entityTypes: options.entityTypes,
        limit: options.pageSize || options.limit || 50
    };
    
    const result = await executeQuery('entity_search', 'search', searchOptions);
    const items = result?.results ?? [];
    if (result && result.results) {
        return { items, totalCount: items.length };
    }
    return { items: [], totalCount: 0, error: new Error("Failed to fetch search or unexpected response structure") };
};