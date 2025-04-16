import { executeQuery, partialUpdate } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getProjectInstitutions = async (projectId, page, pageSize, fetchFn) => {
    const response = await executeQuery('institutions', 'list', { projectId, page, pageSize }, fetchFn);
    return response;
};

export const getInstitution = async (institutionId, fetchFn) => {
    const result = await executeQuery('institutions', 'getById', { institutionId }, fetchFn);
    return result.result;
};

export const updateInstitution = async (institutionId, updateData) => {

    // Add institutionId to the update params
    const params = {
        institutionId,
        ...updateData
    };

    const result = await partialUpdate('institutions', 'update', params);
    return result;
};