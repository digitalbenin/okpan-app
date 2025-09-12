import { executeQuery } from "$lib/stores/GraphqlUtils.js";

export const getSearch = async (options) => {
    // Entity search requires a query parameter, use empty string if not provided
    const searchOptions = {
        query: options.query || "", // Required parameter
        projectId: options.projectId,
        entityTypes: options.entityTypes || ["objects"], // Default to objects only
        limit: options.pageSize || options.limit || 50
    };
    
    const result = await executeQuery('entity_search', 'search', searchOptions);
    if (result && result.result) {
        return { items: result.result.results || [], totalCount: result.result.results.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch search or unexpected response structure") };
};