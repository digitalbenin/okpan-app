export const languagesOperations = {
    create: {
        type: "mutation",
        name: "Create Content Language",
        description: "Creates a new content language for translations",
        variables: {
            code: "Language code (e.g., 'en', 'es')",
            name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateContentLanguage($code: String!, $name: String!) {\n  insertIntoLanguages(values: [{\n    code: $code,\n    name: $name\n  }]) {\n    id\n    code\n    name\n  }\n}`
    },
    delete: {
        type: "mutation",
        name: "Delete Content Language",
        description: "Deletes a content language by its code",
        variables: {
            code: "Language code to delete"
        },
        query: `mutation DeleteContentLanguage($code: String!) {\n  deleteFromLanguages(where: { code: { eq: $code } }) {\n    code\n    name\n  }\n}`
    },
    list: {
        type: "query",
        name: "List Content Languages",
        description: "Lists all supported content languages",
        query: `{\n  result: languages {\n    id\n    code\n    name\n  }\n}`
    },
    listByProject: {
        type: "query",
        name: "List Content Languages by Project",
        description: "Lists all languages associated with a specific project",
        variables: {
            projectId: "ID of the project"
        },
        query: `query GetProjectLanguages($projectId: String!) {\n  result: project_languages(where: { project_id: { eq: $projectId } }) {\n    language_code\n    is_default\n    language {\n      code\n      name\n    }\n  }\n}`
    }
}; 