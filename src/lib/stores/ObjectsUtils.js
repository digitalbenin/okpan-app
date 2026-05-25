import { executeQuery } from "$lib/api/graphqlClient.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate, invalidateAll } from "$app/navigation";
import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

/**
 * Returns the primary identifier label for an object.
 * @param {object} object Object-like record.
 * @returns {string} Primary identifier text or a translated fallback.
 */
export function getObjectIdentifier(object) {
    const { t } = getTranslationStore();
    return object?.objectsOntologyFields?.find((f) => f.primary)?.value
        || t("common.identifier-not-set", { fallback: "Identifier not set" });
}

// Get validation store
const { getSchema, validate } = getValidationStore();


export const getObjects = async (options) => {
    const result = await executeQuery('objects', 'list', options);
    // console.log(result, "result")
    if (result && result.result) {
        return { items: result.result.items || [], totalCount: result.result.totalCount || 0 };
    }

    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch objects or unexpected response structure") };
};

// Function to search objects with advanced filtering and faceted results
export const searchObjects = async (options) => {
    // Ensure payload is JSON-serializable for IPC/structured clone
    let safeOptions;
    try {
        safeOptions = JSON.parse(JSON.stringify(options ?? {}));
    } catch (e) {
        console.warn('Failed to serialize search options, falling back to shallow copy', e);
        safeOptions = { ...(options || {}) };
    }
    const result = await executeQuery('object_search', 'search', safeOptions);
    if (result && result.result) {
        return {
            items: result.result.items || [],
            totalCount: result.result.totalCount || 0,
            facets: result.result.facets || { institutions: [], statuses: [], researchFields: [] }
        };
    }

    return {
        items: [],
        totalCount: 0,
        facets: { institutions: [], statuses: [], researchFields: [] },
        error: result?.error || new Error("Failed to search objects or unexpected response structure")
    };
};


export const getTotalObjectsForInstitution = async (projectId, institutionId) => {
    const result = await executeQuery('objects', 'list', { projectId, institutionId, pageSize: 1, page: 0 });

    if (result && result.result && typeof result.result.totalCount === 'number') {
        return { totalCount: result.result.totalCount };
    }
    return { totalCount: 0, error: result?.error || new Error("Failed to fetch total objects count or unexpected response structure") };
};

// Function to get a single object by ID with complete data including research fields
export const getObjectById = async (objectId) => {
    if (!objectId) {
        return { error: "Invalid objectId for getObjectById" };
    }

    const result = await executeQuery('objects', 'getById', { objectId });

    if (result.error) {
        return { error: result.error };
    }

    if (!result.result || !result.result.length) {
        return { error: "Object not found" };
    }

    // Return the first (and should be only) result
    return { result: result.result[0], error: null };
};

export const createObject = async (
    projectId,
    institutionId,
    status = "draft",
    name
) => {
    if (!projectId || !institutionId) {
        return { error: "Invalid project ID or institution ID for createObject" };
    }

    const params = { projectId, institutionId, status, name };
    // Remove undefined to avoid GraphQL variable issues
    Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

    const response = await executeQuery("objects", "create", params);

    if (response.error) {
        return { error: response.error };
    }

    // Extract the result data
    let resultData = null;
    if (
        response.insertIntoObjects &&
        Array.isArray(response.insertIntoObjects) &&
        response.insertIntoObjects.length > 0
    ) {
        resultData = response.insertIntoObjects[0];
    }

    // Invalidate caches to reflect the change, including project stats
    await invalidateAll();

    return {
        result: resultData,
        error: null,
    };
};

// Function to update object status
export const updateObjectStatus = async (objectId, status) => {
    if (!objectId) {
        return { error: "Invalid object ID for status update" };
    }

    if (!status) {
        return { error: "Invalid status value for update" };
    }

    const response = await executeQuery('objects', 'update', {
        objectId: objectId,
        status: status
    });

    if (response.error) {
        return { error: response.error };
    }

    // Extract the result data
    let resultData = null;
    if (response.updateObjects && Array.isArray(response.updateObjects) && response.updateObjects.length > 0) {
        resultData = response.updateObjects[0];
    }
    // Invalidate caches to ensure UI reflects status changes immediately, including project stats
    await invalidateAll();

    return {
        result: resultData || { id: objectId, status: status },
        error: null
    };
};

// Bulk update objects status
export const updateObjectsStatusBulk = async (objectIds, status) => {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        return { error: "No objects selected for status update" };
    }
    if (!status) {
        return { error: "No status provided for bulk update" };
    }

    const promises = objectIds.map((objectId) =>
        executeQuery('objects', 'update', { objectId, status })
    );

    const settled = await Promise.allSettled(promises);
    const successes = [];
    const errors = [];

    settled.forEach((res, idx) => {
        const id = objectIds[idx];
        if (res.status === 'fulfilled' && !res.value?.error) {
            successes.push(id);
        } else {
            const errMsg = res.status === 'rejected'
                ? (res.reason?.message || 'Unknown error')
                : (res.value?.error || 'Unknown error');
            errors.push({ objectId: id, error: errMsg });
        }
    });

    // Invalidate caches so listings and detail pages reflect status changes, including project stats
    await invalidateAll();

    return { successes, errors };
};

// Add: Function to update object's institution
export const updateObjectInstitution = async (objectId, institutionId) => {
    if (!objectId) {
        return { error: "Invalid object ID for institution update" };
    }

    if (!institutionId) {
        return { error: "Invalid institution ID for update" };
    }

    const response = await executeQuery('objects', 'update', {
        objectId,
        institutionId
    });

    if (response?.error) {
        return { error: response.error };
    }

    let resultData = null;
    if (response.updateObjects && Array.isArray(response.updateObjects) && response.updateObjects.length > 0) {
        resultData = response.updateObjects[0];
    }

    // Invalidate caches to reflect the change (object details and listings), including project stats
    await invalidateAll();

    return {
        result: resultData || { id: objectId, institution_id: institutionId },
        error: null
    };
};

// Function to update object research fields
export const updateObjectResearchFields = async (objectId, changes) => {
    if (!objectId || !changes || changes.length === 0) {
        return { error: "Invalid parameters for updateObjectResearchFields" };
    }

    const results = [];
    const errors = [];

    const buildResearchFieldRecordId = (targetObjectId, fieldId, vocabularyId) => {
        if (vocabularyId) {
            return `objects_research_fields:${targetObjectId}:${fieldId}:${vocabularyId}`;
        }

        return crypto.randomUUID();
    };

    for (const change of changes) {
        let response;

        // If change.action is 'delete', remove the research field record
        if (change.action === 'delete' && change.id) {
            const params = {
                recordId: change.id
            };

            response = await executeQuery('objects', 'objectRemoveResearchField', params);
        }
        // If change.id exists, it's an update to existing objects_research_fields record
        else if (change.id) {
            const params = {
                objectId: objectId,
                fieldId: change.id,
                value: change.value,
                vocabularyId: change.vocabularyId
            };

            response = await executeQuery('objects', 'objectUpdateResearchField', params);
        }
        // If change.id is null/undefined, it's a new assignment
        else if (change.fieldId) {
            const params = {
                recordId: buildResearchFieldRecordId(objectId, change.fieldId, change.vocabularyId),
                objectId: objectId,
                fieldId: change.fieldId,
                value: change.value,
                vocabularyId: change.vocabularyId
            };

            response = await executeQuery('objects', 'objectAssignResearchField', params);
        } else {
            errors.push("Change missing both record ID and field ID");
            continue;
        }

        if (response && response.error) {
            errors.push(`Failed to process field change: ${response.error}`);
        } else {
            let fieldResult = null;
            if (response.result && Array.isArray(response.result) && response.result.length > 0) {
                // Handle the case where the result is directly in an array under response.result
                fieldResult = response.result[0];
            } else {
                // Fallback to previous checks if the structure is different
                fieldResult = response.result?.updateObjects_research_fields ||
                    response.result?.insertIntoObjects_research_fields?.[0] ||
                    response.result?.deleteFromObjects_research_fields?.[0] ||
                    response.result?.result ||
                    response.updateObjects_research_fields ||
                    response.insertIntoObjects_research_fields?.[0] ||
                    response.deleteFromObjects_research_fields?.[0] ||
                    null;
            }

            if (fieldResult) {
                results.push(fieldResult);
            } else {
                // If no result data but no explicit error, create a minimal result object
                results.push({ id: change.id || change.fieldId, value: change.value });
            }
        }
    }

    // Return results with any errors
    if (errors.length > 0) {
        return {
            results,
            error: errors.join("; ")
        };
    }
    invalidate("app:objects");

    return { results, error: null };
};


// Function to delete an object
export const deleteObject = async (objectId) => {
    if (!objectId) {
        return { error: "Invalid object ID for deleteObject" };
    }

    const result = await executeQuery('objects', 'delete', { objectId });
    invalidate("app:objects");
    invalidate("app:projects");
    try { invalidate("app:project-shared"); } catch (_) {}
    return result;
};

// Bulk delete objects
export const deleteObjectsBulk = async (objectIds) => {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        return { error: "No objects selected for deletion" };
    }

    const promises = objectIds.map((objectId) =>
        executeQuery('objects', 'delete', { objectId })
    );

    const settled = await Promise.allSettled(promises);
    const successes = [];
    const errors = [];

    settled.forEach((res, idx) => {
        const id = objectIds[idx];
        if (res.status === 'fulfilled' && !res.value?.error) {
            successes.push(id);
        } else {
            const errMsg = res.status === 'rejected'
                ? (res.reason?.message || 'Unknown error')
                : (res.value?.error || 'Unknown error');
            errors.push({ objectId: id, error: errMsg });
        }
    });

    // Invalidate caches to reflect deletions
    await invalidateAll();

    return { successes, errors };
};

// Function to unlink an asset from an object
export const unlinkAssetFromObject = async (objectId, assetId) => {
    if (!objectId || !assetId) {
        return { error: "Invalid objectId or assetId for unlinkAssetFromObject" };
    }
    const result = await executeQuery('objects', 'removeAsset', { objectId, assetId });

    if (result.error) {
        return { error: result.error };
    }
    // Invalidate caches to reflect the change
    invalidate("app:objects"); // Invalidate objects as their asset list changes
    invalidate("app:assets");  // Invalidate assets as their linked status changes
    invalidate("app:projects");
    try { invalidate("app:project-shared"); } catch (_) {}
    
    return { result: result.deleteFromObjects_assets, error: null };
};

export const importObjectsAndTemplate = async (params) => {
    if (!params) {
        return { error: "Invalid parameters for importObjectsAndTemplate" };
    }
    console.log(params)
    const result = await executeQuery('objects', 'import', params);
    console.log("Import result:", result);
    if (result?.error) {
        return { error: result.error };
    }

    return result;
};

// Function to update asset order in objects_assets table
export const updateAssetOrder = async (objectId, assetId, order) => {
    if (!objectId || !assetId || order === undefined) {
        return { error: "Invalid parameters for updateAssetOrder" };
    }

    const result = await executeQuery('objects', 'updateAssetOrder', {
        objectId,
        assetId,
        order
    });

    if (result.error) {
        return { error: result.error };
    }

    // Invalidate caches to reflect the change
    invalidate("app:objects");
    invalidate("custom:object");

    return { result: result.updateObjects_assets, error: null };
};

// Function to reorder multiple assets at once
export const reorderAssets = async (objectId, assetOrders) => {
    if (!objectId || !assetOrders || assetOrders.length === 0) {
        return { error: "Invalid parameters for reorderAssets" };
    }

    try {
        const updatePromises = assetOrders.map(({ assetId, order }) =>
            updateAssetOrder(objectId, assetId, order)
        );

        const results = await Promise.all(updatePromises);

        // Check for errors
        const errors = results.filter(result => result.error);
        if (errors.length > 0) {
            return { error: errors.map(e => e.error).join("; ") };
        }

        return { results: results.map(r => r.result), error: null };
    } catch (error) {
        return { error: `Failed to reorder assets: ${error.message}` };
    }
};

// Function to link an asset to an object
export const linkAssetToObject = async (objectId, assetId, order) => {
    if (!objectId || !assetId) {
        return { error: "Invalid objectId or assetId for linkAssetToObject" };
    }

    // Attempt insert; rely on DB unique constraint to prevent duplicates
    const result = await executeQuery('objects', 'addAsset', { objectId, assetId, order });

    if (result?.error) {
        const msg = typeof result.error === 'string' ? result.error : (result.error?.message || '');
        if (/UNIQUE|already\s*linked|exists|duplicate/i.test(msg)) {
            return { result: null, error: null, skipped: true };
        }
        return { error: result.error };
    }

    // Invalidate caches to reflect the change
    invalidate("app:objects");
    invalidate("app:assets");
    invalidate("custom:object");
    invalidate("app:projects");
    try { invalidate("app:project-shared"); } catch (_) {}

    return { result: result.insertIntoObjects_assets, error: null };
};

// Bulk, additive linking of multiple assets to multiple objects
// Skips duplicates (unique object-asset pairs) gracefully
export const linkAssetsToObjectsBulk = async (assetIds, objectIds, { order } = {}) => {
    // Validate inputs
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return { successes: [], skippedDuplicates: [], errors: [{ error: "No assets selected for linking" }] };
    }
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        return { successes: [], skippedDuplicates: [], errors: [{ error: "No objects selected for linking" }] };
    }

    const successes = [];
    const skippedDuplicates = [];
    const errors = [];

    // Perform additive linking across all combinations, rely on DB unique constraint
    for (const assetId of assetIds) {
        for (const objectId of objectIds) {
            const oid = String(objectId);
            const aid = String(assetId);
            try {
                const res = await executeQuery('objects', 'addAsset', { objectId: oid, assetId: aid, order });
                if (res?.error) {
                    const msg = typeof res.error === 'string' ? res.error : (res.error?.message || '');
                    if (/UNIQUE|already\s*linked|exists|duplicate/i.test(msg)) {
                        skippedDuplicates.push({ objectId: oid, assetId: aid });
                        continue;
                    }
                    errors.push({ objectId: oid, assetId: aid, error: res.error });
                    continue;
                }
                successes.push({ objectId: oid, assetId: aid });
            } catch (e) {
                const msg = e?.message || e;
                if (/UNIQUE|already\s*linked|exists|duplicate/i.test(msg)) {
                    skippedDuplicates.push({ objectId: oid, assetId: aid });
                    continue;
                }
                errors.push({ objectId: oid, assetId: aid, error: msg });
            }
        }
    }

    // Consolidated invalidation to refresh listings and detail pages
    await invalidateAll();

    return { successes, skippedDuplicates, errors };
};

// Bulk update objects institution
export const updateObjectsInstitutionBulk = async (objectIds, institutionId) => {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
        return { error: "No objects selected for institution update" };
    }
    if (!institutionId) {
        return { error: "No institution provided for bulk update" };
    }

    const promises = objectIds.map((objectId) =>
        executeQuery('objects', 'update', { objectId, institutionId })
    );

    const settled = await Promise.allSettled(promises);
    const successes = [];
    const errors = [];

    settled.forEach((res, idx) => {
        const id = objectIds[idx];
        if (res.status === 'fulfilled' && !res.value?.error) {
            successes.push(id);
        } else {
            const errMsg = res.status === 'rejected'
                ? (res.reason?.message || 'Unknown error')
                : (res.value?.error || 'Unknown error');
            errors.push({ objectId: id, error: errMsg });
        }
    });

    // Invalidate caches so listings and detail pages reflect institution changes, including project stats
    await invalidateAll();

    return { successes, errors };
};

// Function to update object name
export const updateObjectName = async (objectId, name) => {
    if (!objectId) {
        return { error: "Invalid object ID for name update" };
    }

    // Allow empty string to explicitly clear the name
    const params = { objectId, name };
    Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

    const response = await executeQuery('objects', 'update', params);

    if (response?.error) {
        return { error: response.error };
    }

    let resultData = null;
    if (response.updateObjects && Array.isArray(response.updateObjects) && response.updateObjects.length > 0) {
        resultData = response.updateObjects[0];
    }

    // Invalidate caches to reflect the change (object details and listings)
    invalidate("app:objects");
    invalidate("custom:object");

    return {
        result: resultData || { id: objectId, name },
        error: null
    };
};

// Default pastel color palette for connection field types
const CONNECTION_COLORS = [
    "#FFFFFF"
];
/*
const CONNECTION_COLORS = [
    "#E0F2F1", // Light teal
    "#FFF4E6", // Light orange
    "#F3E5F5", // Light purple
    "#E8F5E9", // Light green
    "#FCE4EC", // Light pink
    "#FFF3E0", // Light amber
    "#E1F5FE", // Light blue
    "#F9FBE7", // Light lime
    "#FFEBEE", // Light rose
    "#E8EAF6", // Light indigo
];
*/
/**
 * Get a consistent color for a connection field type
 * Uses a hash function to ensure the same field type always gets the same color
 */
export const getConnectionFieldColor = (fieldName) => {
    if (!fieldName) return CONNECTION_COLORS[0];
    
    // Simple hash function for consistent color assignment
    let hash = 0;
    const str = String(fieldName);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    // Use absolute value and modulo to get a color index
    const index = Math.abs(hash) % CONNECTION_COLORS.length;
    return CONNECTION_COLORS[index];
};