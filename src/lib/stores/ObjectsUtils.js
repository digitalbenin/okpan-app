import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate } from "$app/navigation";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getObjects = async (projectId, institutionId) => {
    const result = await executeQuery('objects', 'list', { projectId, institutionId });
    return result.result;
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
    invalidate("app:objects");

    return {
        result: resultData || { id: objectId, status: status },
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

    for (const change of changes) {
        // Skip invalid changes
        if (!change.id) {
            errors.push("Change missing field ID");
            continue;
        }

        const params = {
            objectId: objectId,
            fieldId: change.id,
            value: change.value,
            vocabularyId: change.vocabularyId
        };

        const response = await executeQuery('objects', 'objectUpdateResearchField', params);

        if (response && response.error) {
            errors.push(`Failed to update field ${change.id}: ${response.error}`);
        } else {
            let fieldResult = null;
            if (response.result && Array.isArray(response.result) && response.result.length > 0) {
                // Handle the case where the result is directly in an array under response.result
                fieldResult = response.result[0];
            } else {
                // Fallback to previous checks if the structure is different (less likely now)
                fieldResult = response.result?.updateObjects_research_fields ||
                    response.result?.result ||
                    response.updateObjects_research_fields ||
                    null;
            }

            if (fieldResult) {
                results.push(fieldResult);
            } else {
                // If no result data but no explicit error, create a minimal result object
                results.push({ id: change.id, value: change.value });
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

    return { results, error: null };
};

// Function to delete an object
export const deleteObject = async (objectId) => {
    if (!objectId) {
        return { error: "Invalid object ID for deleteObject" };
    }

    const result = await executeQuery('objects', 'delete', { objectId });
    invalidate("app:objects");
    return result;
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

    return { result: result.deleteFromObjects_assets, error: null };
};