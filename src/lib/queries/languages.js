export const languagesOperations = {
    create: {
        type: "mutation",
        name: "Create Content Language",
        description: "Creates a new content language for translations",
        variables: {
            code: "Language code (e.g., 'en', 'es')",
            name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateContentLanguage($code: String!, $name: String!) {
  insertIntoLanguages(values: [{ code: $code, name: $name }]) {
    id
    code
    name
  }
}`
    },
    delete: {
        type: "mutation",
        name: "Delete Content Language",
        description: "Deletes a content language by its code",
        variables: {
            code: "Language code to delete"
        },
        query: `mutation DeleteContentLanguage($code: String!) {
  deleteFromLanguages(where: { code: { eq: $code } }) {
    code
    name
  }
}`
    },
    list: {
        type: "query",
        name: "List Content Languages",
        description: "Lists all supported content languages",
        query: `{
  result: languages {
    id
    code
    name
  }
}`
    },
    listByProject: {
        type: "query",
        name: "List Content Languages by Project",
        description: "Lists all languages associated with a specific project",
        variables: {
            projectId: "ID of the project"
        },
        query: `query GetProjectLanguages($projectId: String!) {
  result: project_languages(where: { project_id: { eq: $projectId } }) {
    language_code
    is_default
    language {
      code
      name
    }
  }
}`
    }
}; 