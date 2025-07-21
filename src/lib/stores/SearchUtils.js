import { executeQuery } from "$lib/stores/GraphqlUtils.js";

export const getSearch = async (options) => {
    const result = await executeQuery('entity_search', 'search', options);
    if (result && result.result) {
        return { items: result.result.results || [], totalCount: result.result.results.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch search or unexpected response structure") };
};