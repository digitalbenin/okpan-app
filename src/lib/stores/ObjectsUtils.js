import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getObjects = async (projectId, institutionId) => {
    const result = await executeQuery('objects', 'list', { projectId, institutionId });
    return result.result;
};

// Function to get a single object by ID with complete data including research fields
export const getObjectById = async (objectId) => {
    if (!objectId) {
        console.error("Invalid objectId for getObjectById");
        return { error: "Invalid objectId" };
    }

    try {
        console.log(`Fetching complete data for object: ${objectId}`);
        const result = await executeQuery('objects', 'getById', { objectId });

        if (result.error) {
            console.error("Error fetching object:", result.error);
            return { error: result.error };
        }

        if (!result.result || !result.result.length) {
            console.error("No object found with ID:", objectId);
            return { error: "Object not found" };
        }

        // Return the first (and should be only) result
        return { result: result.result[0], error: null };
    } catch (error) {
        console.error("Exception in getObjectById:", error);
        return { error: error.message || "Unknown error fetching object" };
    }
};

// Function to update object research fields
export const updateObjectResearchFields = async (objectId, changes) => {
    if (!objectId || !changes || changes.length === 0) {
        console.error("Invalid parameters for updateObjectResearchFields");
        return { error: "Invalid parameters" };
    }

    console.log(`Starting update of ${changes.length} research fields for object ${objectId}`);
    console.log("Changes:", changes);

    try {
        // Process each field update as a separate mutation
        const results = [];
        const errors = [];

        for (const change of changes) {
            // Skip invalid changes
            if (!change.id) {
                console.error("Change missing field ID", change);
                errors.push("Change missing field ID");
                continue;
            }

            const params = {
                objectId: objectId,
                fieldId: change.id,
                value: change.value,
                vocabularyId: change.vocabularyId
            };

            console.log(`Updating research field ${change.id} with value: ${change.value}${change.vocabularyId ? `, vocabularyId: ${change.vocabularyId}` : ''}`);
            try {
                const response = await executeQuery('objects', 'objectUpdateResearchField', params);
                console.log(`Raw response from updating field ${change.id}:`, JSON.stringify(response));

                if (response && response.error) {
                    console.error(`Error updating field ${change.id}:`, response.error);
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
                        console.log(`Successfully updated field ${change.id}:`, fieldResult);
                        results.push(fieldResult);
                    } else {
                        // If no result data but no explicit error, create a minimal result object
                        console.warn(`No result data for field ${change.id}, using fallback`);
                        results.push({ id: change.id, value: change.value });
                    }
                }
            } catch (fieldError) {
                console.error(`Exception updating field ${change.id}:`, fieldError);
                errors.push(`Exception updating field ${change.id}: ${fieldError.message}`);
            }
        }

        // Return results with any errors
        if (errors.length > 0) {
            console.warn("Completed with errors:", errors);
            return {
                results,
                error: errors.join("; ")
            };
        }

        console.log("Successfully updated all fields");
        return { results, error: null };
    } catch (error) {
        console.error("Error in updateObjectResearchFields:", error);
        return { error: error.message || "Unknown error updating research fields" };
    }
};