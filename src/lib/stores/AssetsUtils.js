import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";
export const getAssets = async (projectId, institutionId) => {
    let result = await executeQuery('assets', 'list', { projectId, institutionId });
    return result.result;
};

export const deleteAsset = async (assetId) => {
    let result = await executeQuery('assets', 'delete', { assetId: assetId });
    invalidate("app:assets");
    return result;
};
