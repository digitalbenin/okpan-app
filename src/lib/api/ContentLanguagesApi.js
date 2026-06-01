import { executeQuery } from "$lib/api/graphqlClient.js";

/**
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
export async function listContentLanguages() {
    return await executeQuery('languages', 'list');
}

/**
 * @param {string} projectId
 * @returns {Promise<Array>}
 */
export async function listContentLanguagesByProject(projectId) {
    return await executeQuery('languages', 'listByProject', { projectId });
}

/**
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.code
 * @param {string} params.name
 * @param {number} [params.isDefault=0]
 * @returns {Promise<Array>}
 */
export async function createContentLanguage({ projectId, code, name, isDefault = 0 }) {
    const result = await executeQuery('languages', 'create', { projectId, code, name, isDefault });
    return result;
}

/**
 * @param {string} languageId
 * @returns {Promise<Array>}
 */
export async function deleteContentLanguage(languageId) {
    return await executeQuery('languages', 'delete', { languageId });
}
