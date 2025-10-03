import { executeQuery } from "$lib/stores/GraphqlUtils.js";

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
    const items = result?.result?.results ?? [];
    if (result && result.result) {
        return { items, totalCount: items.length };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch search or unexpected response structure") };
};