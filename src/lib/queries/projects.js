export const projectsOperations = {
  // CREATE
  create: {
    type: "mutation",
    name: "Create Project",
    description: "Creates a new project, sets default language, creates texts, and seeds ontology fields",
    variables: {
      title: "Title of the project",
      description: "Description of the project",
      languageCode: "Language code for the default language",
      languageName: "Language name for the default language"
    },
    query: `mutation CreateProjectWithDefaults(
  $title: String!
  $description: String
  $languageCode: String!
  $languageName: String
) {
  result:createProjectWithDefaults(
    title: $title,
    description: $description,
    languageCode: $languageCode,
    languageName: $languageName
  ) {
    project { id title_id description_id }
    defaultLanguage { id code name is_default }
    titleText { id }
    descriptionText { id }
    ontologyFieldsCreated
  }
}`
  },

  // UPDATE
  update: {
    type: "mutation",
    name: "Update Project",
    description: "Updates an existing project by ID",
    variables: {
      projectId: "ID of the project to update",
      title: "New title content (optional)",
      description: "New description content (optional)",
      // Translation arrays
      titleTranslations: "Array of title translations (optional)",
      descriptionTranslations: "Array of description translations (optional)"
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
      },
      // === TRANSLATION PROCESSING STEPS ===
      {
        name: "processTitleTranslations",
        processTranslations: {
          textIdPath: "getProject.project.0.title_id",
          translationsParam: "titleTranslations"
        }
      },
      {
        name: "processDescriptionTranslations",
        processTranslations: {
          textIdPath: "getProject.project.0.description_id",
          translationsParam: "descriptionTranslations"
        }
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
    query: `mutation DeleteProjectCascade($projectId: String!) {
  result: deleteProjectCascade(projectId: $projectId) {
    projectId
    deleted
    assetsFolderRemoved
    assetFolderErrors
    counts {
      actions
      websiteSettings
      settings
      objects
      assets
      genericAssets
      templates
      institutions
      researchFields
      ontologyFields
      objectDisplayFields
      translations
      texts
      languages
      imports
      project
    }
  }
}`
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
      original_language_id
      translations {
        id
        content
        language_id
        language {
          id
          code
          name
        }
      }
    }
    description {
      id
      content
      original_language_id
      translations {
        id
        content
        language_id
        language {
          id
          code
          name
        }
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
      original_language_id
      translations {
        id
        content
        language_id
        language {
          id
          code
          name
        }
      }
    }
    description {
      id
      content
      original_language_id
      translations {
        id
        content
        language_id
        language {
          id
          code
          name
        }
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
      languageName: "Name of the language to add",
      isDefault: "Whether this is the default language (0 or 1)"
    },
    query: `mutation AddProjectLanguage($projectId: String!, $languageCode: String!, $languageName: String!, $isDefault: Int!) {
  insertIntoLanguages(
    values: [
      {
        project_id: $projectId
        code: $languageCode
        name: $languageName
        is_default: $isDefault
      }
    ]
  ) {
    id
    project_id
    code
    name
    is_default
  }
}`
  },

  // Remove Language from Project
  removeLanguage: {
    type: "mutation",
    name: "Remove Language from Project",
    description: "Removes a language from a project and all its related translations",
    variables: {
      languageId: "ID of the language to remove"
    },
    query: `mutation RemoveProjectLanguage($languageId: String!) {
  # First, delete all translations that reference this language
  deleteTranslations: deleteFromTranslations(
    where: { language_id: { eq: $languageId } }
  ) {
    id
  }
  # Then, delete the language itself
  deleteLanguage: deleteFromLanguages(
    where: { id: { eq: $languageId } }
  ) {
    id
    project_id
    code
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
      languageId: "ID of the language to set as default"
    },
    query: `mutation SetProjectDefaultLanguage($projectId: String!, $languageId: String!) {
  # First, set all languages for this project to non-default
  updateAllToNonDefault: updateLanguages(
    set: { is_default: 0 }
    where: { project_id: { eq: $projectId } }
  ) {
    id
    project_id
  }
  # Then, set the specified language as default
  setNewDefault: updateLanguages(
    set: { is_default: 1 }
    where: { id: { eq: $languageId } }
  ) {
    id
    project_id
    code
    is_default
  }
}`
  }
};