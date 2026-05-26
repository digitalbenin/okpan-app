export const languagesOperations = {
  create: {
    type: "mutation",
    name: "Create Content Language",
    description: "Creates a new content language for a project",
    variables: {
      projectId: "ID of the project to add the language to",
      code: "Language code (e.g., 'en', 'es')",
      name: "Language name (e.g., 'English', 'Spanish')",
      isDefault: "Whether this is the default language for the project (optional, defaults to 0)"
    },
    query: `mutation CreateContentLanguage($projectId: String!, $code: String!, $name: String!, $isDefault: Int = 0) {
  result: insertIntoLanguages(values: [{ 
    project_id: $projectId,
    code: $code, 
    name: $name,
    is_default: $isDefault
  }]) {
    id
    project_id
    code
    name
    is_default
  }
}`
  },
  delete: {
    type: "mutation",
    name: "Delete Content Language",
    description: "Deletes a content language by its ID",
    variables: {
      languageId: "Language ID to delete"
    },
    query: `mutation DeleteContentLanguage($languageId: String!) {
  result: deleteFromLanguages(where: { id: { eq: $languageId } }) {
    id
    code
    name
  }
}`
  },
  list: {
    type: "query",
    name: "List Content Languages",
    description: "Lists all supported content languages for all projects",
    query: `{
  result: languages {
    id
    project_id
    code
    name
    is_default
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
  result: languages(where: { project_id: { eq: $projectId } }) {
    id
    code
    name
    is_default
  }
}`
  },
  getByCode: {
    type: "query",
    name: "Get Language By Code",
    description: "Retrieves a language by its code",
    variables: {
      code: "Language code (e.g., 'en', 'es')"
    },
    query: `query GetLanguageByCode($code: String!) {
  result: languages(where: { code: { eq: $code } }) {
    id
    code
    name
  }
}`
  }
}; 