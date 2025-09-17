import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";


export const getAssets = async (options) => {
    const result = await executeQuery('assets', 'list', options);
    if (result && result.result) {
        return { items: result.result.items || [], totalCount: result.result.totalCount || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch assets or unexpected response structure") };
};


export const getTotalAssetsForInstitution = async (projectId, institutionId) => {
    // We call the same 'list' operation but are only interested in totalCount
    // The GraphQL query for 'list' in assets.js already includes totalCount
    // We pass only essential filters for an unfiltered count for the institution.
    const result = await executeQuery('assets', 'list', { projectId, institutionId, pageSize: 1, page: 0 }); // pageSize/page are technically not needed by totalCount query but good practice for a list call
    if (result && result.result && typeof result.result.totalCount === 'number') {
        return { totalCount: result.result.totalCount };
    }
    return { totalCount: 0, error: result?.error || new Error("Failed to fetch total assets count or unexpected response structure") };
};

export const updateAsset = async (assetId, data) => {
    const result = await executeQuery('assets', 'update', { assetId, ...data });
    invalidate("app:assets");
    return result;
};

export const getAssetById = async (assetId) => {
    let result = await executeQuery('assets', 'getById', { assetId: assetId });
    return result;
};

export const deleteAsset = async (assetId) => {
    let result = await executeQuery('assets', 'delete', { assetId: assetId });
    invalidate("app:assets");
    return result;
};
