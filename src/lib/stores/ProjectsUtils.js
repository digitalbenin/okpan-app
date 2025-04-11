import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { API_SECTIONS } from "$lib/utils/queries.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

// Initialize the project store

export const getProjects = async () => {
    const result = await executeQuery('projects', 'list');
    return result.result;
};

export const getProject = async (projectId) => {
    const result = await executeQuery('projects', 'getById', { projectId });
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
    // Validate the input
    const validationResult = await validate(project, getSchema('project', 'update'));
    if (!validationResult.success) {
        throw new Error(validationResult.errors[0]);
    }

    // Use executeQuery which handles errors, logging, and notifications
    return await executeQuery('projects', 'update', { projectId, ...project });
};

export const deleteProject = async (projectId) => {
    // Use executeQuery which handles errors, logging, and notifications
    return await executeQuery('projects', 'delete', { projectId });
};

export const addLanguageToProject = async (projectId, languageCode) => {
    // Use executeQuery which handles errors, logging, and notifications
    return await executeQuery('projects', 'addLanguage', { projectId, languageCode });
};

export const removeLanguageFromProject = async (projectId, languageCode) => {
    // Use executeQuery which handles errors, logging, and notifications
    return await executeQuery('projects', 'removeLanguage', { projectId, languageCode });
};

export const setLanguageAsDefault = async (projectId, languageCode) => {
    // Use executeQuery which handles errors, logging, and notifications
    return await executeQuery('projects', 'setDefaultLanguage', { projectId, languageCode });
};

