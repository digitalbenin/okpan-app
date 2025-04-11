import { executeQuery } from "$lib/stores/GraphqlUtils.js";

export const getAssets = async (projectId, institutionId) => {
    let result = await executeQuery('assets', 'list', { projectId, institutionId });
    return result.result;
};