import { executeQuery } from "$lib/stores/GraphqlUtils.js";

export const getDisplayFields = async (params = {}) => {
    const response = await executeQuery('object_display_fields', 'listByProject', params);
    return response;
};

export const createDisplayField = async (params = {}) => {
    const response = await executeQuery('object_display_fields', 'create', params);
    return response;
};

export const deleteDisplayField = async (fieldId) => {
    console.log("Deleting display field with ID:", { fieldId });
    const response = await executeQuery('object_display_fields', 'delete', { fieldId });
    return response;
};