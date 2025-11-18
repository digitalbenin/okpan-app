import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate, invalidateAll } from "$app/navigation";


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

// Bulk delete assets
export const deleteAssetsBulk = async (assetIds) => {
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return { error: "No assets selected for deletion" };
    }

    const response = await executeQuery('assets', 'deleteBulk', { ids: assetIds });
    const payload = response?.result || {};
    const successes = payload.deletedIds || [];
    const missingIds = payload.missingIds || [];
    const fileErrors = payload.fileErrors || [];
    const errors = [];

    if (missingIds.length) {
        errors.push(...missingIds.map((id) => ({ assetId: id, error: 'Asset not found' })));
    }

    if (fileErrors.length) {
        errors.push(...fileErrors.map((entry) => ({ assetId: entry.asset_id, error: entry.error || 'File removal failed', path: entry.path })));
    }

    // Invalidate caches to reflect deletions
    invalidate("app:assets");
    //invalidateAll();

    return { successes, errors, missingIds, fileErrors };
};

// Bulk link assets to multiple objects following the same paradigm
// links format: [{ asset_id: String, object_ids: [String, ...] }, ...]
export const bulkLinkAssetsToObjects = async (links) => {
    if (!Array.isArray(links) || links.length === 0) {
        // Nothing to link, but treat as a successful no-op so the import flow can finish gracefully
        return { successes: [], skippedDuplicates: [], errors: [] };
    }

    const result = await executeQuery('assets', 'linkObjectsBulk', { links });

    // Invalidate caches to reflect new associations
    invalidate("app:assets");

    // Normalize response
    if (result && result.result) {
        const payload = result.result;
        return {
            successes: payload.successes || [],
            skippedDuplicates: payload.skippedDuplicates || [],
            errors: payload.errors || []
        };
    }

    return { successes: [], skippedDuplicates: [], errors: [], error: result?.error || new Error("Bulk link failed or unexpected response structure") };
};
