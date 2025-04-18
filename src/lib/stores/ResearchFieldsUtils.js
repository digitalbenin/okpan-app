import { executeQuery } from "$lib/stores/GraphqlUtils.js";

// Note: Replace 'researchFields', 'list', 'getById', etc., with your actual GraphQL section and operation names.


export const getResearchFields = async (projectId, page, pageSize) => {
    // Assuming 'research_fields' is the section and 'list' is the operation
    const params = { projectId };
    if (page !== undefined) params.page = page;
    if (pageSize !== undefined) params.pageSize = pageSize;
    const response = await executeQuery('research_fields', 'list', params);
    return response; // Or response.result depending on executeQuery's return structure
};


export const getResearchFieldById = async (fieldId) => {
    // Assuming 'research_fields' is the section and 'getById' is the operation
    const result = await executeQuery('research_fields', 'getById', { fieldId });
    return result.result; // Adjust if executeQuery returns differently
};


export const createResearchField = async (fieldData) => {
    // Assuming 'research_fields' is the section and 'create' is the operation
    const result = await executeQuery('research_fields', 'create', fieldData);
    return result;
};


export const updateResearchField = async (fieldId, updateData) => {
    const params = { fieldId, ...updateData };
    // Assuming 'research_fields' is the section and 'update' is the operation
    // Consider using partialUpdate if available and appropriate
    const result = await executeQuery('research_fields', 'update', params);
    return result;
};

export const deleteResearchField = async (fieldId) => {
    // Assuming 'research_fields' is the section and 'delete' is the operation
    const result = await executeQuery('research_fields', 'delete', { fieldId });
    return result;
}; 