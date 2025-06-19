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
        query: `mutation CreateProjectTitle($projectName: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $projectName
        context: "project.title"
        original_language: $languageCode
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["projectName", "languageCode"]
      },
      {
        name: "createDescription",
        query: `mutation CreateProjectDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(
    values: [
      {
        content: $description
        context: "project.description"
        original_language: $languageCode
      }
    ]
  ) {
    id
  }
}`,
        useVariables: ["description", "languageCode"]
      },
      {
        name: "createProject",
        query: `mutation CreateProjectEntry($titleId: String!, $descriptionId: String!) {
  insertIntoProject(
    values: [
      {
        title_id: $titleId
        description_id: $descriptionId
      }
    ]
  ) {
    id
    title_id
    description_id
  }
}`,
        mapVariables: {
          titleId: { from: "createTitle", path: "insertIntoTexts.0.id" },
          descriptionId: { from: "createDescription", path: "insertIntoTexts.0.id" }
        }
      },
      {
        name: "addDefaultLanguage",
        query: `mutation AddDefaultLanguage($projectId: String!, $languageCode: String!) {
  insertIntoProject_languages(
    values: [
      {
        project_id: $projectId
        language_code: $languageCode
        is_default: 1
      }
    ]
  ) {
    project_id
    language_code
    is_default
  }
}`,
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
        query: `query GetProjectForUpdate($projectId: String!) {
  project(where: { id: { eq: $projectId } }) {
    id
    title_id
    description_id
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "updateTitle",
        query: `mutation UpdateProjectTitle($titleId: String!, $title: String!) {
  updateTexts(
    set: { content: $title }
    where: { id: { eq: $titleId } }
  ) {
    id
    content
  }
}`,
        useVariables: ["title"],
        mapVariables: {
          titleId: { from: "getProject", path: "project.0.title_id" }
        },
        skipIf: { variableName: "title", isUndefined: true }
      },
      {
        name: "updateDescription",
        query: `mutation UpdateProjectDescription($descriptionId: String!, $description: String!) {
  updateTexts(
    set: { content: $description }
    where: { id: { eq: $descriptionId } }
  ) {
    id
    content
  }
}`,
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
        query: `query GetProjectForDelete($projectId: String!) {
  project(where: { id: { eq: $projectId } }) {
    id
    title_id
    description_id
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "deleteProjectLanguages",
        query: `mutation DeleteProjectLanguages($projectId: String!) {
  deleteFromProject_languages(where: { project_id: { eq: $projectId } }) {
    project_id
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "deleteInstitutions",
        query: `mutation DeleteProjectInstitutions($projectId: String!) {
  deleteFromInstitutions(where: { project_id: { eq: $projectId } }) {
    id
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "deleteObjects",
        query: `mutation DeleteProjectObjects($projectId: String!) {
  deleteFromObjects(where: { project_id: { eq: $projectId } }) {
    id
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "deleteProject",
        query: `mutation DeleteProjectFinal($projectId: String!) {
  deleteFromProject(where: { id: { eq: $projectId } }) {
    id
    title_id
    description_id
  }
}`,
        useVariables: ["projectId"]
      },
      {
        name: "deleteTitleText",
        query: `mutation DeleteProjectTitleText($titleId: String!) {
  deleteFromTexts(where: { id: { eq: $titleId } }) {
    id
  }
}`,
        mapVariables: {
          titleId: { from: "getProject", path: "project.0.title_id" }
        },
        skipIf: { variableName: "titleId", isUndefined: true }
      },
      {
        name: "deleteDescriptionText",
        query: `mutation DeleteProjectDescriptionText($descriptionId: String!) {
  deleteFromTexts(where: { id: { eq: $descriptionId } }) {
    id
  }
}`,
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
    query: `query GetProjectById($projectId: String!) {
  result: projectById(project_id: $projectId) {
    id
    created_at
    updated_at
    title_id
    description_id
    title {
      id
      content
      original_language
      translations {
        id
        content
        language_code
      }
    }
    description {
      id
      content
      original_language
      translations {
        id
        content
        language_code
      }
    }
    institutionsCount
    objectsCount
    assetsCount
    completedObjectsCount
    linkedAssetsCount
  }
}`
  },

  // LIST - Using the custom resolver from graphqlDefs.js
  list: {
    type: "query",
    name: "List Projects With Counts",
    description: "Retrieves all projects with their aggregated counts",
    query: `{
  result: projectsList {
    id
    created_at
    updated_at
    title_id
    description_id
    title {
      id
      content
      original_language
      translations {
        id
        content
        language_code
      }
    }
    description {
      id
      content
      original_language
      translations {
        id
        content
        language_code
      }
    }
    institutionsCount
    objectsCount
    assetsCount
  }
}`
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
    query: `mutation AddProjectLanguage($projectId: String!, $languageCode: String!, $isDefault: Int!) {
  insertIntoProject_languages(
    values: [
      {
        project_id: $projectId
        language_code: $languageCode
        is_default: $isDefault
      }
    ]
  ) {
    project_id
    language_code
    is_default
  }
}`
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
    query: `mutation RemoveProjectLanguage($projectId: String!, $languageCode: String!) {
  deleteFromProject_languages(
    where: { project_id: { eq: $projectId }, language_code: { eq: $languageCode } }
  ) {
    project_id
    language_code
  }
}`
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
    query: `mutation SetProjectDefaultLanguage($projectId: String!, $languageCode: String!) {
  # First, set all languages for this project to non-default
  updateAllToNonDefault: updateProject_languages(
    set: { is_default: 0 }
    where: { project_id: { eq: $projectId } }
  ) {
    project_id
  }
  # Then, set the specified language as default
  setNewDefault: updateProject_languages(
    set: { is_default: 1 }
    where: { project_id: { eq: $projectId }, language_code: { eq: $languageCode } }
  ) {
    project_id
    language_code
    is_default
  }
}`
  }
}; 