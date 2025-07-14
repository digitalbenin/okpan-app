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
    const languageCode = defaultLang.code;
    const languageName = defaultLang.name;

    // Get mutations from the API_SECTIONS
    const mutations = API_SECTIONS.projects.operations.create.mutations;

    // Step 1: Create project first
    const projectResult = await performCustomMutation(mutations[2], {
        // We'll need to create empty project first, then update with text IDs
    });
    const projectId = projectResult.insertIntoProject[0].id;

    // Step 2: Create language for the project
    const languageResult = await performCustomMutation(mutations[3], {
        projectId,
        languageCode,
        languageName,
    });
    const languageId = languageResult.insertIntoLanguages[0].id;

    // Step 3: Create title
    const titleResult = await performCustomMutation(mutations[0], {
        projectName,
        languageId,
    });
    const titleId = titleResult.insertIntoTexts[0].id;

    // Step 4: Create description
    const descriptionResult = await performCustomMutation(mutations[1], {
        description,
        languageId,
    });
    const descriptionId = descriptionResult.insertIntoTexts[0].id;

    // Step 5: Update project with text IDs
    await updateProject(projectId, {
        title: { content: projectName },
        description: { content: description }
    });

    // Step 6: Add translations if any (both for title and description)
    if (project.title.translations?.length || project.description.translations?.length) {
        // For each translation, we need to find or create the corresponding language
        for (const translation of project.title.translations || []) {
            if (translation.content && translation.language_id) {
                await executeQuery('translations', 'create', {
                    textId: titleId,
                    languageId: translation.language_id,
                    content: translation.content,
                });
            }
        }

        for (const translation of project.description.translations || []) {
            if (translation.content && translation.language_id) {
                await executeQuery('translations', 'create', {
                    textId: descriptionId,
                    languageId: translation.language_id,
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

// Function to update a project, including translations orchestration
export const updateProject = async (projectId, updatedData) => {
    if (!projectId) {
        return { result: null, error: "Missing Project ID" };
    }

    console.log('=== PROJECT UNIFIED UPDATE ===');
    console.log('Update parameters:', JSON.stringify(updatedData, null, 2));

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
        if (updateParams[key] === undefined) {
            delete updateParams[key];
        }
    });

    console.log('Final parameters for projects update:', updateParams);

    // Execute the multi-step mutation
    const result = await executeQuery('projects', 'update', updateParams);

    if (result.error) {
        console.error('Project update error:', result.error);
        return { result: null, error: result.error };
    }

    console.log('Project update completed successfully');
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
    invalidate("app:projects");
    return result;
};

export const removeLanguageFromProject = async (languageId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'removeLanguage', { languageId });
    invalidate("app:projects");
    return result;
};

export const setLanguageAsDefault = async (projectId, languageId) => {
    // Use executeQuery which handles errors, logging, and notifications
    const result = await executeQuery('projects', 'setDefaultLanguage', { projectId, languageId });
    invalidate("app:projects");
    return result;
};

