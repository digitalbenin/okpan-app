import { executeQuery } from "$lib/api/graphqlClient.js";

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