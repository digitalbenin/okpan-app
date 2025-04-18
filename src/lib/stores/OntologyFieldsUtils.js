import { executeQuery } from "$lib/stores/GraphqlUtils.js";


export const getOntologyFields = async (page, pageSize) => {
    // Assuming 'ontology_fields' is the section and 'list' is the operation
    const params = {};
    if (page !== undefined) params.page = page;
    if (pageSize !== undefined) params.pageSize = pageSize;
    const response = await executeQuery('ontology_fields', 'list', params);
    return response; // Or response.result depending on executeQuery's return structure
};

export const getOntologyFieldById = async (fieldId) => {
    // Assuming 'ontology_fields' is the section and 'getById' is the operation
    const result = await executeQuery('ontology_fields', 'getById', { fieldId });
    return result.result; // Adjust if executeQuery returns differently
};

export const createOntologyField = async (fieldData) => {
    // Assuming 'ontology_fields' is the section and 'create' is the operation
    const result = await executeQuery('ontology_fields', 'create', fieldData);
    return result;
};

export const updateOntologyField = async (fieldId, updateData) => {
    const params = { fieldId, ...updateData };
    // Assuming 'ontology_fields' is the section and 'update' is the operation
    // Consider using partialUpdate if available and appropriate
    const result = await executeQuery('ontology_fields', 'update', params);
    return result;
};

export const deleteOntologyField = async (fieldId) => {
    // Assuming 'ontology_fields' is the section and 'delete' is the operation
    const result = await executeQuery('ontology_fields', 'delete', { fieldId });
    return result;
}; 