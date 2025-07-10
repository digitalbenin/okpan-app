import { executeQuery } from "$lib/stores/GraphqlUtils.js";

export const getActions = async (options) => {
    const result = await executeQuery('actions', 'list', options);
    if (result && result.result) {
        return { items: result.result || [], totalCount: result.result.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch actions or unexpected response structure") };
};