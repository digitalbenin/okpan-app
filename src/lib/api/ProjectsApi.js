import { executeQuery } from "$lib/api/graphqlClient.js";
import { invalidate, invalidateAll } from "$app/navigation";

/**
 * @namespace frontend.api.ProjectsApi
 */

/**
 * Returns all projects.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @returns {Promise.<Array.<Object>>} Array of project records.
 */
export const getProjects = async () => {
    const result = await executeQuery('projects', 'list');
    return result;
};

/**
 * Returns a single project by ID, with enriched title/description references.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @returns {Promise.<Object>} The project record with title_id, description_id, and parsed translations.
 */
export const getProject = async (projectId) => {
    const result = await executeQuery('projects', 'getById', { projectId });

    // Make sure we add title_id and description_id to the result for easier access
    if (result) {
        // Try to extract directly from existing fields
        const project = result;

        //console.log("Processing project data:", JSON.stringify(project, null, 2));

        // Add direct references to the IDs if not already present
        if (!project.title_id && project.title) {
            // Use a safe method to get the ID
            project.title_id = project.title.id;
            //console.log("Extracted title_id:", project.title_id);
        }

        if (!project.description_id && project.description) {
            // Use a safe method to get the ID
            project.description_id = project.description.id;
            //console.log("Extracted description_id:", project.description_id);
        }

        // Additional check for translations array - ensure it's properly initialized
        if (project.title && !project.title.translations) {
            project.title.translations = [];
        }

        if (project.description && !project.description.translations) {
            project.description.translations = [];
        }

        // If translations are in JSON string format, parse them
        if (project.title && typeof project.title.translations === 'string') {
            try {
                project.title.translations = JSON.parse(project.title.translations);
            } catch (e) {
                console.warn("Failed to parse title translations:", e);
                project.title.translations = [];
            }
        }

        if (project.description && typeof project.description.translations === 'string') {
            try {
                project.description.translations = JSON.parse(project.description.translations);
            } catch (e) {
                console.warn("Failed to parse description translations:", e);
                project.description.translations = [];
            }
        }
    }

    return result;
};

/**
 * Returns all languages enabled for a project.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @returns {Promise.<Array.<{code: string, name: string}>>} Array of language records.
 */
export const getProjectLanguages = async (projectId) => {
    const result = await executeQuery('languages', 'listByProject', { projectId });
    return result || [];
};

/**
 * Creates a new project with initial localised title and description.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {Object} project - Project data.
 * @param {string} project.title - Project title.
 * @param {string} [project.description=''] - Project description.
 * @param {{code: string, name: string}} project.defaultLanguage - Default language.
 * @param {boolean} [project.isShared=false] - Whether the project is P2P shared.
 * @param {string|null} [project.password=null] - P2P password if shared.
 * @returns {Promise.<{id: (string|null), title_id: (string|null), description_id: (string|null)}>}
 * @throws {Error} If title or defaultLanguage.code is missing.
 */
export const createProject = async (project) => {
    // Expect: { title: string, description: string, defaultLanguage: { code, name } }
    if (!project?.title || !project?.defaultLanguage?.code) {
        throw new Error("Missing required project data: title, defaultLanguage.code");
    }

    const title = project.title;
    const description = project.description ?? "";
    const languageCode = project.defaultLanguage.code;
    const languageName = project.defaultLanguage.name || project.defaultLanguage.code;
    const isShared = project.isShared ? 1 : 0;
    const password = project.password || null;

    // Use the registered single-step mutation in queries/projects.js
    const response = await executeQuery('projects', 'create', { 
        title, 
        description, 
        languageCode, 
        languageName,
        isShared,
        password 
    });

    const result = response;
    const projectId = result?.project?.id || result?.id || null;
    const titleId = result?.project?.title_id || result?.titleText?.id || null;
    const descriptionId = result?.project?.description_id || result?.descriptionText?.id || null;

    // Trigger background embeddings computation for any new ontology fields
    try {
        if (typeof window !== 'undefined' && window.api?.computeAllMissingEmbeddings) {
            await window.api.computeAllMissingEmbeddings();
        }
    } catch (e) {
        console.warn('[ProjectsUtils] Embeddings backfill failed', e);
    }

    invalidate("app:projects");
    return {
        id: projectId,
        title_id: titleId,
        description_id: descriptionId
    };
};

// Helper function to execute a single mutation from a multi-step mutation chain
async function performCustomMutation(mutation, params) {
    const queryObj = { name: mutation.name, query: mutation.query };
    return await executeQuery('custom', 'mutation', { query: queryObj, params });
}

/**
 * Updates a project's title and description, including translation orchestration.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {Object} updatedData - Updated fields (title, description, titleTranslations, descriptionTranslations).
 * @returns {Promise.<{result: (Object|null), error: (string|null)}>}
 */
export const updateProject = async (projectId, updatedData) => {
    if (!projectId) {
        return { result: null, error: "Missing Project ID" };
    }



    // Prepare all parameters for the multi-step mutation
    const updateParams = {
        projectId: projectId,
        // Text content for default language
        title: updatedData.title?.content,
        description: updatedData.description?.content,
        // Translation arrays
        titleTranslations: updatedData.titleTranslations,
        descriptionTranslations: updatedData.descriptionTranslations
    };

    // Remove undefined values to prevent GraphQL errors
    Object.keys(updateParams).forEach(key => {
        if (updateParams[key] === undefined || updateParams[key] === null) {
            delete updateParams[key];
        }
    });



    // Execute the multi-step mutation
    const result = await executeQuery('projects', 'update', updateParams);

    if (result.error) {
        console.error('Project update error:', result.error);
        return { result: null, error: result.error };
    }


    invalidate("app:projects");
    return { result, error: null };
};

/**
 * Updates P2P sharing settings for a project.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {Object} [options] - Sharing options.
 * @param {boolean} [options.isShared] - Whether sharing is enabled.
 * @param {string|null} [options.password] - Sharing password.
 * @returns {Promise.<{result: (Object|null), error: (string|null)}>}
 */
export const updateProjectSharingSettings = async (projectId, { isShared, password } = {}) => {
    if (!projectId) {
        return { result: null, error: "Missing Project ID" };
    }

    const params = {
        projectId,
        isShared: isShared ? 1 : 0,
        password: password ?? null,
    };

    try {
        const result = await executeQuery('projects', 'updateSharingSettings', params);
        invalidate("app:projects");
        return { result, error: null };
    } catch (error) {
        console.error('Project sharing settings update error:', error);
        return { result: null, error: error.message || error };
    }
};

/**
 * Deletes a project (database record and associated files).
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @returns {Promise.<{success: boolean, projectId: (string|undefined), assetsFolderRemoved: (boolean|undefined), snapshotsFolderRemoved: (boolean|undefined), counts: (Object|undefined), error: (string|undefined)}>}
 */
export const deleteProject = async (projectId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const response = await executeQuery('projects', 'delete', { projectId });
    
    if (response?.error) {
        return { success: false, error: response.error };
    }
    
    const result = response;
    invalidate("app:projects");
    
    return {
        success: result?.deleted || false,
        projectId: result?.projectId,
        assetsFolderRemoved: result?.assetsFolderRemoved,
        snapshotsFolderRemoved: result?.snapshotsFolderRemoved,
        counts: result?.counts
    };
};

/**
 * Adds a language to a project.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {string} languageCode - BCP 47 language code.
 * @param {string} languageName - Human-readable language name.
 * @param {number} [isDefault=0] - Whether this is the default language (1/0).
 * @returns {Promise.<Object>} Operation result.
 */
export const addLanguageToProject = async (projectId, languageCode, languageName, isDefault = 0) => {
    const normalizedCode = String(languageCode || '').trim().toLowerCase();
    if (!projectId || !normalizedCode) {
        return { error: 'Project ID and language code are required', result: null };
    }

    const existingLanguages = await getProjectLanguages(projectId);
    if (existingLanguages.some((language) => String(language.code || '').trim().toLowerCase() === normalizedCode)) {
        return { error: `Language "${languageCode}" is already enabled for this project`, result: null };
    }

    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'addLanguage', {
        projectId,
        languageCode,
        languageName,
        isDefault
    });
    await invalidateAll();
    return result;
};

/**
 * Removes a language from a project.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} languageId - The language assignment ID.
 * @returns {Promise.<Object>} Operation result.
 */
export const removeLanguageFromProject = async (languageId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'removeLanguage', { languageId });
    await invalidateAll();
    return result;
};

/**
 * Sets a language as the default for a project.
 * @memberOf frontend.api.ProjectsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {string} languageId - The language assignment ID to set as default.
 * @returns {Promise.<Object>} Operation result.
 */
export const setLanguageAsDefault = async (projectId, languageId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'setDefaultLanguage', { projectId, languageId });
    await invalidateAll();
    return result;
};

