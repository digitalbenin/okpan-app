import { executeQuery } from "$lib/stores/GraphqlUtils.js";

export const getAssets = async (projectId, institutionId) => {
    let result = await executeQuery('assets', 'list', { projectId, institutionId });
    return result.result;
};

export const deleteAsset = async (assetId) => {
    let result = await executeQuery('asset', 'delete', { id: assetId });
    return result;
};
