import { executeQuery, partialUpdate } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate } from "$app/navigation";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getProjectInstitutions = async (projectId, page, pageSize, orderBy, direction, search) => {
    const response = await executeQuery('institutions', 'list', { projectId, page, pageSize, orderBy, direction, search });

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
    invalidate("app:institutions");
    return result;
};

export const deleteInstitution = async (institutionId) => {
    const result = await executeQuery('institutions', 'delete', { institutionId });
    invalidate("app:institutions");
    return result;
};