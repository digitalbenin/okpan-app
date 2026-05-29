import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate } from "$app/navigation";

/**
 * @namespace frontend.api.TemplatesApi
 */

/**
 * Returns all import templates for an institution.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {string} institutionId - The institution ID.
 * @returns {Promise.<Array.<Object>>} Array of template records.
 * @throws {Error} If institutionId is missing.
 */
export const getTemplatesByInstitution = async (institutionId) => {
  if (!institutionId) {
    throw new Error("Institution ID is required to fetch templates");
  }
  return await executeQuery("templates", "getByInstitution", { institutionId });
};

/**
 * Creates a new import template.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {Object} params - Template data.
 * @param {Object} params.mapping - Column-to-field mapping object.
 * @param {string} params.projectId - The project ID.
 * @param {string} params.institutionId - The institution ID.
 * @param {string} params.title - Human-readable template name.
 * @returns {Promise.<Object>} The created template record.
 * @throws {Error} If projectId or mapping is missing.
 */
export const createTemplate = async ({ mapping, projectId, institutionId, title }) => {
  if (!projectId) {
    throw new Error("Project ID is required to create a template");
  }
  if (!mapping) {
    throw new Error("Template mapping is required");
  }

  const variables = {
    name: title,
    mapping,
    projectId,
    institutionId,
  };

  const result = await executeQuery("templates", "create", variables);
  invalidate("app:templates");
  return result;
};

/**
 * Updates an existing import template.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {string} templateId - The template ID.
 * @param {Object} params - Updated template data.
 * @param {Object} params.mapping - Column-to-field mapping object.
 * @param {string} params.institutionId - The institution ID.
 * @param {string} params.title - Human-readable template name.
 * @returns {Promise.<Object>} The updated template record.
 * @throws {Error} If templateId is missing.
 */
export const updateTemplate = async (templateId, { mapping, institutionId, title }) => {
  if (!templateId) {
    throw new Error("Template ID is required to update a template");
  }

  const variables = {
    templateId,
    name: title,
    mapping,
    institutionId,
  };

  const result = await executeQuery("templates", "update", variables);
  invalidate("app:templates");
  return result;
};

/**
 * Deletes a template by ID.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {string} templateId - The template ID.
 * @returns {Promise.<Object>} Delete result.
 * @throws {Error} If templateId is missing.
 */
export const deleteTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required to delete a template");
  }
  const result = await executeQuery("templates", "delete", { templateId });
  invalidate("app:templates");
  return result;
};

/**
 * Deletes a template and removes all associated ontology field references from objects.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {string} templateId - The template ID.
 * @returns {Promise.<Object>} Delete result including cleanup details.
 * @throws {Error} If templateId is missing.
 */
export const deleteTemplateAndCleanup = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required to delete a template");
  }
  const result = await executeQuery("templates", "deleteAndCleanup", { templateId });
  invalidate("app:templates");
  invalidate("app:objects");
  return result;
};

/**
 * Counts the number of objects currently using a template.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {string} templateId - The template ID.
 * @returns {Promise.<{count: number}>} Count of linked objects.
 * @throws {Error} If templateId is missing.
 */
export const countObjectsUsingTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }
  return await executeQuery("templates", "countObjects", { templateId });
};

/**
 * Updates a template and propagates field changes to all linked objects.
 * @memberOf frontend.api.TemplatesApi
 * @method
 * @param {string} templateId - The template ID.
 * @param {Object} params - Updated template data.
 * @param {Object} params.mapping - Column-to-field mapping object.
 * @param {string} params.institutionId - The institution ID.
 * @param {string} params.title - Human-readable template name.
 * @returns {Promise.<Object>} The updated template record with propagation details.
 * @throws {Error} If templateId or mapping is missing.
 */
export const updateTemplateAndPropagate = async (templateId, { mapping, institutionId, title }) => {
  if (!templateId) {
    throw new Error("Template ID is required to update a template");
  }
  if (!mapping) {
    throw new Error("Template mapping is required");
  }

  const variables = {
    templateId,
    name: title,
    mapping,
    institutionId,
  };

  const result = await executeQuery("templates", "updateAndPropagate", variables);
  
  // Invalidate to refresh all related data
  invalidate("app:templates");
  invalidate("app:objects");
  
  return result;
};
