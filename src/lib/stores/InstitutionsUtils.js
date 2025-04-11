import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getProjectInstitutions = async (projectId, page, pageSize) => {
    const response = await executeQuery('institutions', 'list', { projectId, page, pageSize });
    return response;
};

export const getInstitution = async (institutionId) => {
    const result = await executeQuery('institutions', 'getById', { institutionId });
    return result.result;
};