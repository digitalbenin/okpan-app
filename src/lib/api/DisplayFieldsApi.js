import { executeQuery } from "$lib/api/graphqlClient.js";

/**
 * @namespace frontend.api.DisplayFieldsApi
 */

/**
 * Returns display field configurations for a project.
 * @memberOf frontend.api.DisplayFieldsApi
 * @method
 * @param {Object} [params={}] - Query filters (projectId, institutionId, page, pageSize).
 * @returns {Promise.<Object>} List result with shape <code>{ items: Array.<Object>, totalCount: number }</code>.
 */
export const getDisplayFields = async (params = {}) => {
    const response = await executeQuery('object_display_fields', 'list', params);
    return response;
};

/**
 * Creates a new display field configuration.
 * @memberOf frontend.api.DisplayFieldsApi
 * @method
 * @param {Object} [params={}] - Display field data (ontology_field_id, projectId, institutionId, order, view_type).
 * @returns {Promise.<Object>} The created display field record.
 */
export const createDisplayField = async (params = {}) => {
    const response = await executeQuery('object_display_fields', 'create', params);
    return response;
};

/**
 * Deletes a display field configuration by ID.
 * @memberOf frontend.api.DisplayFieldsApi
 * @method
 * @param {string} fieldId - The display field ID.
 * @returns {Promise.<Object>} Delete result.
 */
export const deleteDisplayField = async (fieldId) => {
    console.log("Deleting display field with ID:", { fieldId });
    const response = await executeQuery('object_display_fields', 'delete', { fieldId });
    return response;
};