import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getObjects = async (projectId, institutionId) => {
    const result = await executeQuery('objects', 'list', { projectId, institutionId });
    return result.result;
};