import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate } from "$app/navigation";

export const getOntologyFields = async (projectId, page, pageSize) => {
    // Require projectId for project-specific ontology fields
    if (!projectId) {
        throw new Error('Project ID is required to fetch ontology fields');
    }

    const params = { projectId };
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
    // Ensure projectId is provided for project-specific ontology fields
    if (!fieldData.projectId) {
        throw new Error('Project ID is required to create ontology fields');
    }

    const result = await executeQuery('ontology_fields', 'create', fieldData);
    invalidate("app:ontology_fields");
    return result;
};

export const updateOntologyField = async (fieldId, updateData) => {
    const params = { fieldId, ...updateData };
    // Assuming 'ontology_fields' is the section and 'update' is the operation
    // Consider using partialUpdate if available and appropriate
    const result = await executeQuery('ontology_fields', 'update', params);
    invalidate("app:ontology_fields");
    return result;
};

export const deleteOntologyField = async (fieldId) => {
    // Assuming 'ontology_fields' is the section and 'delete' is the operation
    const result = await executeQuery('ontology_fields', 'delete', { fieldId });
    invalidate("app:ontology_fields");
    return result;
}; 