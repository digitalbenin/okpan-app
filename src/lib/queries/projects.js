export const projectsOperations = {
    // CREATE
    create: {
        type: "mutation",
        name: "Create Project",
        description: "Creates a new project with title and description",
        variables: {
            projectName: "Name of the project",
            description: "Description of the project",
            languageCode: "Language code for the initial text"
        },
        mutations: [
            {
                name: "createTitle",
                query: `mutation CreateProjectTitle($projectName: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $projectName,\n    context: "project.title",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["projectName", "languageCode"]
            },
            {
                name: "createDescription",
                query: `mutation CreateProjectDescription($description: String!, $languageCode: String!) {\n  insertIntoTexts(values: [{\n    content: $description,\n    context: "project.description",\n    original_language: $languageCode\n  }]) {\n    id\n  }\n}`,
                useVariables: ["description", "languageCode"]
            },
            {
                name: "createProject",
                query: `mutation CreateProjectEntry($titleId: String!, $descriptionId: String!) {\n  insertIntoProject(values: [{\n    title_id: $titleId,\n    description_id: $descriptionId\n  }]) {\n    id\n    title_id\n    description_id\n  }\n}`,
                mapVariables: {
                    titleId: { from: "createTitle", path: "insertIntoTexts.0.id" },
                    descriptionId: { from: "createDescription", path: "insertIntoTexts.0.id" }
                }
            },
            {
                name: "addDefaultLanguage",
                query: `mutation AddDefaultLanguage($projectId: String!, $languageCode: String!) {\n  insertIntoProject_languages(values: [{\n    project_id: $projectId,\n    language_code: $languageCode,\n    is_default: 1\n  }]) {\n    project_id\n    language_code\n    is_default\n  }\n}`,
                useVariables: ["languageCode"],
                mapVariables: {
                    projectId: { from: "createProject", path: "insertIntoProject.0.id" }
                }
            }
        ],
        query: null
    },

    // UPDATE
    update: {
        type: "mutation",
        name: "Update Project",
        description: "Updates an existing project by ID",
        variables: {
            projectId: "ID of the project to update",
            title: "New title content (optional)",
            description: "New description content (optional)"
        },
        mutations: [
            {
                name: "getProject",
                query: `query GetProjectForUpdate($projectId: String!) {\n  project(where: { id: { eq: $projectId } }) {\n    id\n    title_id\n    description_id\n  }\n}`,
                useVariables: ["projectId"]
            },
            {
                name: "updateTitle",
                query: `mutation UpdateProjectTitle($titleId: String!, $title: String!) {\n  updateTexts(\n    set: { content: $title }\n    where: { id: { eq: $titleId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["title"],
                mapVariables: {
                    titleId: { from: "getProject", path: "project.0.title_id" }
                },
                skipIf: { variableName: "title", isUndefined: true }
            },
            {
                name: "updateDescription",
                query: `mutation UpdateProjectDescription($descriptionId: String!, $description: String!) {\n  updateTexts(\n    set: { content: $description }\n    where: { id: { eq: $descriptionId } }\n  ) {\n    id\n    content\n  }\n}`,
                useVariables: ["description"],
                mapVariables: {
                    descriptionId: { from: "getProject", path: "project.0.description_id" }
                },
                skipIf: { variableName: "description", isUndefined: true }
            }
        ],
        query: null
    },

    // DELETE
    delete: {
        type: "mutation",
        name: "Delete Project",
        description: "Deletes a project by ID",
        variables: {
            projectId: "ID of the project to delete"
        },
        mutations: [
            {
                name: "getProject",
                query: `query GetProjectForDelete($projectId: String!) {\n  project(where: { id: { eq: $projectId } }) {\n    id\n    title_id\n    description_id\n  }\n}`,
                useVariables: ["projectId"]
            },
            {
                name: "deleteProjectLanguages",
                query: `mutation DeleteProjectLanguages($projectId: String!) {\n  deleteFromProject_languages(where: { project_id: { eq: $projectId } }) {\n    project_id\n  }\n}`,
                useVariables: ["projectId"]
            },
            {
                name: "deleteInstitutions",
                query: `mutation DeleteProjectInstitutions($projectId: String!) {\n  deleteFromInstitutions(where: { project_id: { eq: $projectId } }) {\n    id\n  }\n}`,
                useVariables: ["projectId"]
            },
            {
                name: "deleteObjects",
                query: `mutation DeleteProjectObjects($projectId: String!) {\n  deleteFromObjects(where: { project_id: { eq: $projectId } }) {\n    id\n  }\n}`,
                useVariables: ["projectId"]
            },
            {
                name: "deleteProject",
                query: `mutation DeleteProjectFinal($projectId: String!) {\n  deleteFromProject(where: { id: { eq: $projectId } }) {\n    id\n    title_id\n    description_id\n  }\n}`,
                useVariables: ["projectId"]
            },
            {
                name: "deleteTitleText",
                query: `mutation DeleteProjectTitleText($titleId: String!) {\n  deleteFromTexts(where: { id: { eq: $titleId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    titleId: { from: "getProject", path: "project.0.title_id" }
                },
                skipIf: { variableName: "titleId", isUndefined: true }
            },
            {
                name: "deleteDescriptionText",
                query: `mutation DeleteProjectDescriptionText($descriptionId: String!) {\n  deleteFromTexts(where: { id: { eq: $descriptionId } }) {\n    id\n  }\n}`,
                mapVariables: {
                    descriptionId: { from: "getProject", path: "project.0.description_id" }
                },
                skipIf: { variableName: "descriptionId", isUndefined: true }
            }
        ],
        query: null
    },

    // GET BY ID - Using the custom resolver from graphqlDefs.js
    getById: {
        type: "query",
        name: "Get Project by ID With Counts",
        description: "Retrieves a single project by its ID with all related counts",
        variables: {
            projectId: "ID of the project to retrieve"
        },
        query: `query GetProjectById($projectId: String!) {\n  result: projectById(project_id: $projectId) {\n    id\n    created_at\n    updated_at\n    title_id\n    description_id\n    title {\n      id\n      content\n      original_language\n      translations {\n        id\n        content\n        language_code      \n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        id\n        content\n        language_code\n      }\n    }\n    institutionsCount\n    objectsCount\n    assetsCount\n  }\n}`
    },

    // LIST - Using the custom resolver from graphqlDefs.js
    list: {
        type: "query",
        name: "List Projects With Counts",
        description: "Retrieves all projects with their aggregated counts",
        query: `{\n  result: projectsList {\n    id\n    created_at\n    updated_at\n    title_id\n    description_id\n    title {\n      id\n      content\n      original_language\n      translations {\n        id\n        content\n        language_code      \n      }\n    }\n    description {\n      id\n      content\n      original_language\n      translations {\n        id\n        content\n        language_code\n      }\n    }\n    institutionsCount\n    objectsCount\n    assetsCount\n  }\n}`
    },

    // Add Language to Project
    addLanguage: {
        type: "mutation",
        name: "Add Language to Project",
        description: "Adds a language to a project",
        variables: {
            projectId: "ID of the project",
            languageCode: "Code of the language to add",
            isDefault: "Whether this is the default language (0 or 1)"
        },
        query: `mutation AddProjectLanguage($projectId: String!, $languageCode: String!, $isDefault: Int!) {\n  insertIntoProject_languages(values: [{\n    project_id: $projectId,\n    language_code: $languageCode,\n    is_default: $isDefault\n  }]) {\n    project_id\n    language_code\n    is_default\n  }\n}`
    },

    // Remove Language from Project
    removeLanguage: {
        type: "mutation",
        name: "Remove Language from Project",
        description: "Removes a language from a project",
        variables: {
            projectId: "ID of the project",
            languageCode: "Code of the language to remove"
        },
        query: `mutation RemoveProjectLanguage($projectId: String!, $languageCode: String!) {\n  deleteFromProject_languages(\n    where: { \n      project_id: { eq: $projectId },\n      language_code: { eq: $languageCode }\n    }\n  ) {\n    project_id\n    language_code\n  }\n}`
    },

    // Set Default Language
    setDefaultLanguage: {
        type: "mutation",
        name: "Set Project Default Language",
        description: "Sets the default language for a project",
        variables: {
            projectId: "ID of the project",
            languageCode: "Code of the language to set as default"
        },
        query: `mutation SetProjectDefaultLanguage($projectId: String!, $languageCode: String!) {\n  # First, set all languages for this project to non-default\n  updateAllToNonDefault: updateProject_languages(\n    set: { is_default: 0 }\n    where: { project_id: { eq: $projectId } }\n  ) {\n    project_id\n  }\n  # Then, set the specified language as default\n  setNewDefault: updateProject_languages(\n    set: { is_default: 1 }\n    where: { \n      project_id: { eq: $projectId },\n      language_code: { eq: $languageCode }\n    }\n  ) {\n    project_id\n    language_code\n    is_default\n  }\n}`
    }
}; 