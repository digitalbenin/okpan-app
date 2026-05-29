import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate } from "$app/navigation";

/**
 * @namespace frontend.api.OntologyFieldsApi
 */

/**
 * Returns all ontology fields for a project.
 * @memberOf frontend.api.OntologyFieldsApi
 * @method
 * @param {string} projectId - The project ID (required).
 * @param {number} [page] - Page index (0-based).
 * @param {number} [pageSize] - Items per page.
 * @returns {Promise.<{items: Array.<Object>, totalCount: number}>} Paginated ontology fields.
 * @throws {Error} If projectId is missing.
 */
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

/**
 * Returns a single ontology field by ID.
 * @memberOf frontend.api.OntologyFieldsApi
 * @method
 * @param {string} fieldId - The ontology field ID.
 * @returns {Promise.<Object>} The ontology field record.
 */
export const getOntologyFieldById = async (fieldId) => {
    const result = await executeQuery('ontology_fields', 'getById', { fieldId });
    return result;
};

/**
 * Creates a new ontology field for a project.
 * @memberOf frontend.api.OntologyFieldsApi
 * @method
 * @param {Object} fieldData - Field data (projectId, name, label, type, required, is_repeatable, options).
 * @returns {Promise.<Object>} The created ontology field record.
 * @throws {Error} If projectId is missing.
 */
export const createOntologyField = async (fieldData) => {
    // Ensure projectId is provided for project-specific ontology fields
    if (!fieldData.projectId) {
        throw new Error('Project ID is required to create ontology fields');
    }

    const result = await executeQuery('ontology_fields', 'create', fieldData);
    invalidate("app:ontology_fields");
    return result;
};

/**
 * Updates an existing ontology field.
 * @memberOf frontend.api.OntologyFieldsApi
 * @method
 * @param {string} fieldId - The ontology field ID.
 * @param {Object} updateData - Updated field properties (name, label, type, required, is_repeatable, options).
 * @returns {Promise.<Object>} The updated ontology field record.
 */
export const updateOntologyField = async (fieldId, updateData) => {
    const params = { fieldId, ...updateData };
    const result = await executeQuery('ontology_fields', 'update', params);
    invalidate("app:ontology_fields");
    return result;
};

/**
 * Deletes an ontology field by ID.
 * @memberOf frontend.api.OntologyFieldsApi
 * @method
 * @param {string} fieldId - The ontology field ID.
 * @returns {Promise.<Object>} Delete result.
 */
export const deleteOntologyField = async (fieldId) => {
    const result = await executeQuery('ontology_fields', 'delete', { fieldId });
    invalidate("app:ontology_fields");
    return result;
}; 