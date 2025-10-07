import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { API_SECTIONS } from "$lib/queries/index.js";
import { invalidate } from "$app/navigation";
// Get validation store
const { getSchema, validate } = getValidationStore();

// Get schemas for projects
const projectInsertSchema = getSchema('project', 'insert');
const projectUpdateSchema = getSchema('project', 'update');

// Initialize the project store

export const getProjects = async () => {
    const result = await executeQuery('projects', 'list');
    return result.result;
};

export const getProject = async (projectId) => {
    const result = await executeQuery('projects', 'getById', { projectId });

    // Make sure we add title_id and description_id to the result for easier access
    if (result && result.result) {
        // Try to extract directly from existing fields
        const project = result.result;

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

    return result.result;
};

export const getProjectLanguages = async (projectId) => {
    const result = await executeQuery('languages', 'listByProject', { projectId });
    return result.result || [];
};

export const createProject = async (project) => {
    // Expect: { title: string, description: string, defaultLanguage: { code, name } }
    if (!project?.title || !project?.description || !project?.defaultLanguage) {
        throw new Error("Missing required project data: title, description, defaultLanguage");
    }

    const title = project.title;
    const description = project.description;
    const languageCode = project.defaultLanguage.code;
    const languageName = project.defaultLanguage.name || project.defaultLanguage.code;

    // Get mutations from the API_SECTIONS
    const mutations = API_SECTIONS.projects.operations.create.mutations;

    // Step 1: Create project
    const projectResult = await performCustomMutation(mutations[0], {});
    const projectId = projectResult.insertIntoProject[0].id;

    // Step 2: Create default language for the project
    const languageResult = await performCustomMutation(mutations[1], {
        projectId,
        languageCode,
        languageName,
    });
    const languageId = languageResult.insertIntoLanguages[0].id;

    // Step 3: Create title text in default language
    const titleResult = await performCustomMutation(mutations[2], {
        title,
        languageId,
    });
    const titleId = titleResult.insertIntoTexts[0].id;

    // Step 4: Create description text in default language
    const descriptionResult = await performCustomMutation(mutations[3], {
        description,
        languageId,
    });
    const descriptionId = descriptionResult.insertIntoTexts[0].id;

    // Step 5: Link texts to project
    await performCustomMutation(mutations[4], {
        projectId,
        titleId,
        descriptionId,
    });

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

// Function to update a project, including translations orchestration
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
    return { result: result.result, error: null };
};

export const deleteProject = async (projectId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'delete', { projectId });
    invalidate("app:projects");
    return result;
};

export const addLanguageToProject = async (projectId, languageCode, languageName, isDefault = 0) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'addLanguage', {
        projectId,
        languageCode,
        languageName,
        isDefault
    });
    // Centralized cache refreshes for project language changes
    invalidate("app:projects");
    try { invalidate("app:project-shared"); } catch (_) {}
    return result;
};

export const removeLanguageFromProject = async (languageId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'removeLanguage', { languageId });
    // Centralized cache refreshes for project language changes
    invalidate("app:projects");
    try { invalidate("app:project-shared"); } catch (_) {}
    return result;
};

export const setLanguageAsDefault = async (projectId, languageId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'setDefaultLanguage', { projectId, languageId });
    invalidate("app:projects");
    return result;
};

