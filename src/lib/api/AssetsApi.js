import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate, invalidateAll } from "$app/navigation";

/**
 * @namespace frontend.api.AssetsApi
 */

/**
 * Returns paginated list of assets for a project/institution.
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {Object} options - Query filters (projectId, institutionId, objectId, page, pageSize, orderBy, direction).
 * @returns {Promise.<{items: Array.<Object>, totalCount: number, error: (Error|undefined)}>}
 */
export const getAssets = async (options) => {
    const result = await executeQuery('assets', 'list', options);
    if (result) {
        return { items: result.items || [], totalCount: result.totalCount || 0 };
    }
    return { items: [], totalCount: 0, error: new Error("Failed to fetch assets or unexpected response structure") };
};


/**
 * Returns the total number of assets for an institution.
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {string} institutionId - The institution ID.
 * @returns {Promise.<{totalCount: number, error: (Error|undefined)}>}
 */
export const getTotalAssetsForInstitution = async (projectId, institutionId) => {
    // We call the same 'list' operation but are only interested in totalCount
    // The GraphQL query for 'list' in assets.js already includes totalCount
    // We pass only essential filters for an unfiltered count for the institution.
    const result = await executeQuery('assets', 'list', { projectId, institutionId, pageSize: 1, page: 0 }); // pageSize/page are technically not needed by totalCount query but good practice for a list call
    if (result && typeof result.totalCount === 'number') {
        return { totalCount: result.totalCount };
    }
    return { totalCount: 0, error: new Error("Failed to fetch total assets count or unexpected response structure") };
};

/**
 * Updates asset metadata (caption, alt_text, copyright, order).
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {string} assetId - The asset ID.
 * @param {Object} data - Asset fields to update.
 * @returns {Promise.<Object>} The updated asset record.
 */
export const updateAsset = async (assetId, data) => {
    const result = await executeQuery('assets', 'update', { assetId, ...data });
    await invalidateAll();
    return result;
};

/**
 * Returns a single asset by ID.
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {string} assetId - The asset ID.
 * @returns {Promise.<Object>} The asset record including linked objects.
 */
export const getAssetById = async (assetId) => {
    let result = await executeQuery('assets', 'getById', { assetId: assetId });
    return result;
};

/**
 * Deletes a single asset (database record and physical file).
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {string} assetId - The asset ID.
 * @returns {Promise.<Object>} Delete result.
 */
export const deleteAsset = async (assetId) => {
    let result = await executeQuery('assets', 'delete', { assetId: assetId });
    invalidate("app:assets");
    invalidate("app:projects");
    try { invalidate("app:project-shared"); } catch (_) {}
    return result;
};

// Bulk delete assets
/**
 * Bulk deletes multiple assets (database records and physical files).
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {Array.<string>} assetIds - Array of asset IDs to delete.
 * @returns {Promise.<{successes: Array.<string>, errors: Array.<Object>, missingIds: Array.<string>, fileErrors: Array.<Object>}>}
 */
export const deleteAssetsBulk = async (assetIds) => {
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return { error: "No assets selected for deletion" };
    }

    const response = await executeQuery('assets', 'deleteBulk', { ids: assetIds });
    const payload = response || {};
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
    await invalidateAll();

    return { successes, errors, missingIds, fileErrors };
};

// Bulk link assets to multiple objects following the same paradigm
// links format: [{ asset_id: String, object_ids: [String, ...] }, ...]
/**
 * Links multiple assets to multiple objects in bulk.
 * @memberOf frontend.api.AssetsApi
 * @method
 * @param {Array.<{asset_id: string, object_ids: Array.<string>}>} links - Array of link definitions.
 * @returns {Promise.<{successes: Array.<Object>, skippedDuplicates: Array.<Object>, errors: Array.<Object>}>}
 */
export const bulkLinkAssetsToObjects = async (links) => {
    if (!Array.isArray(links) || links.length === 0) {
        // Nothing to link, but treat as a successful no-op so the import flow can finish gracefully
        return { successes: [], skippedDuplicates: [], errors: [] };
    }

    const result = await executeQuery('assets', 'linkObjectsBulk', { links });

    // Invalidate caches to reflect new associations
    await invalidateAll();

    // Normalize response
    if (result) {
        return {
            successes: result.successes || [],
            skippedDuplicates: result.skippedDuplicates || [],
            errors: result.errors || []
        };
    }

    return { successes: [], skippedDuplicates: [], errors: [], error: new Error("Bulk link failed or unexpected response structure") };
};
