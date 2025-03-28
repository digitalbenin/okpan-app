import { API_SECTIONS, performQuery } from "$lib/utils/queries.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";


const { error: logError } = getLogStore();

// Get validation store
const { getSchema, validate } = getValidationStore();


const objectsList = API_SECTIONS.objects.operations.objectsList;


export const getObjects = async (projectId, institutionId) => {
    try {
        const result = await performQuery(objectsList, { projectId, institutionId });
        return result.result;
    } catch (error) {
        // Already handled by performQuery
        throw error;
    }
};