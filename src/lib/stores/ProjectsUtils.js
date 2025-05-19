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

export const createProject = async (project) => {
    // Validate the incoming project data
    if (!project.languages || !project.title || !project.description) {
        throw new Error("Missing required project data");
    }

    // Find the default language
    const defaultLang = project.languages.find(lang => lang.is_default === 1);
    if (!defaultLang) {
        throw new Error("No default language selected");
    }

    const projectName = project.title.content;
    const description = project.description.content;
    const languageCode = defaultLang.language_code;

    // Get mutations from the API_SECTIONS
    const mutations = API_SECTIONS.projects.operations.create.mutations;

    // Step 1: Create title
    const titleResult = await performCustomMutation(mutations[0], {
        projectName,
        languageCode,
    });
    const titleId = titleResult.insertIntoTexts[0].id;

    // Step 2: Create description
    const descriptionResult = await performCustomMutation(mutations[1], {
        description,
        languageCode,
    });
    const descriptionId = descriptionResult.insertIntoTexts[0].id;

    // Step 3: Create project
    const projectResult = await performCustomMutation(mutations[2], {
        titleId,
        descriptionId,
    });
    const projectId = projectResult.insertIntoProject[0].id;

    // Step 4: Add default language
    await performCustomMutation(mutations[3], {
        projectId,
        languageCode,
    });

    // Step 5: Add translations if any (both for title and description)
    if (project.title.translations?.length || project.description.translations?.length) {
        // Add title translations
        for (const translation of project.title.translations || []) {
            if (translation.content) {
                await executeQuery('translations', 'create', {
                    textId: titleId,
                    languageCode: translation.language_code,
                    content: translation.content,
                });
            }
        }

        // Add description translations
        for (const translation of project.description.translations || []) {
            if (translation.content) {
                await executeQuery('translations', 'create', {
                    textId: descriptionId,
                    languageCode: translation.language_code,
                    content: translation.content,
                });
            }
        }
    }

    invalidate("app:projects");
    // Return the new project data
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

export const updateProject = async (projectId, project) => {
    // Validate the project data using our schema
    const validationResult = await validate(project, projectUpdateSchema);

    if (!validationResult.success) {
        throw new Error(validationResult.errors[0]);
    }

    // Prepare the parameters for the multi-step mutation
    // Extract content from nested objects to match the expected format
    const params = {
        projectId,
        title: project.title?.content,
        description: project.description?.content
    };

    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'update', params);

    invalidate("app:projects");
    // Return the result with the project ID for convenience
    return {
        ...result,
        id: projectId,
        // If result contains any useful data, ensure we pass it back
        title_id: result?.title_id,
        description_id: result?.description_id
    };
};

export const deleteProject = async (projectId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'delete', { projectId });
    invalidate("app:projects");
    return result;
};

export const addLanguageToProject = async (projectId, languageCode) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'addLanguage', { projectId, languageCode });
    invalidate("app:projects");
    return result;
};

export const removeLanguageFromProject = async (projectId, languageCode) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'removeLanguage', { projectId, languageCode });
    invalidate("app:projects");
    return result;
};

export const setLanguageAsDefault = async (projectId, languageCode) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'setDefaultLanguage', { projectId, languageCode });
    invalidate("app:projects");
    return result;
};

