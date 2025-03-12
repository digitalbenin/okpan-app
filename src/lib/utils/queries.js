export const API_SECTIONS = {
  interface_languages: {
    name: "Interface Languages",
    operations: {
      interfaceLanguagesList: {
        type: "query",
        name: "List Interface Languages",
        description: "Lists all supported interface languages",
        query: `{
  interface_languages {
    id
    code
    name
  }
}`
      },
      interfaceLanguagesCreate: {
        type: "mutation",
        name: "Create Interface Language",
        description: "Creates a new interface language",
        variables: {
          code: "Language code (e.g., 'en', 'es')",
          name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateInterfaceLanguage($code: String!, $name: String!) {
  insertIntoInterface_languages(values: [{
    code: $code,
    name: $name
  }]) {
    id
    code
    name
  }
}`
      },
      interfaceLanguagesDelete: {
        type: "mutation",
        name: "Delete Interface Language",
        description: "Deletes an interface language by its code",
        variables: {
          code: "Language code to delete"
        },
        query: `mutation DeleteInterfaceLanguage($code: String!) {
  deleteFromInterface_languages(where: { code: { eq: $code } }) {
    code
    name
  }
}`
      }
    }
  },
  languages: {
    name: "Content Languages",
    operations: {
      contentLanguagesCreate: {
        type: "mutation",
        name: "Create Content Language",
        description: "Creates a new content language for translations",
        variables: {
          code: "Language code (e.g., 'en', 'es')",
          name: "Language name (e.g., 'English', 'Spanish')"
        },
        query: `mutation CreateContentLanguage($code: String!, $name: String!) {
  insertIntoLanguages(values: [{
    code: $code,
    name: $name
  }]) {
    id
    code
    name
  }
}`
      },
      contentLanguagesDelete: {
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
      contentLanguagesList: {
        type: "query",
        name: "List Content Languages",
        description: "Lists all supported content languages",
        query: `{
  languages {
    id
    code
    name
  }
}`
      },
      contentLanguagesListByProject: {
        type: "query",
        name: "List Content Languages by Project",
        description: "Lists all languages associated with a specific project",
        variables: {
          projectId: "ID of the project"
        },
        query: `query GetProjectLanguages($projectId: String!) {
  project_languages(where: { project_id: { eq: $projectId } }) {
    language_code
    is_default
    language {
      code
      name
    }
  }
}`
      }
    }
  },
  projects: {
    name: "Projects",
    operations: {
      projectsCreate: {
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
  insertIntoTexts(values: [{
    content: $projectName,
    context: "project.title",
    original_language: $languageCode
  }]) {
    id
  }
}`,
            useVariables: ["projectName", "languageCode"]
          },
          {
            name: "createDescription",
            query: `mutation CreateProjectDescription($description: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $description,
    context: "project.description",
    original_language: $languageCode
  }]) {
    id
  }
}`,
            useVariables: ["description", "languageCode"]
          },
          {
            name: "createProject",
            query: `mutation CreateProjectEntry($titleId: String!, $descriptionId: String!) {
  insertIntoProject(values: [{
    title_id: $titleId,
    description_id: $descriptionId
  }]) {
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
  insertIntoProject_languages(values: [{
    project_id: $projectId,
    language_code: $languageCode,
    is_default: 1
  }]) {
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
      projectsUpdate: {
        type: "mutation",
        name: "Update Project",
        description: "Updates an existing project by ID",
        variables: {
          projectId: "ID of the project to update",
          title: "New title content",
          description: "New description content"
        },
        query: `mutation UpdateProject($projectId: String!, $title: String!, $description: String!) {
  # Update the title translation
  updateTitle: updateTexts(
    set: { content: $title }
    where: { id: { eq: $projectId } }
  ) {
    id
    content
    original_language
  }
  # Update the description translation
  updateDescription: updateTexts(
    set: { content: $description }
    where: { id: { eq: $projectId } }
  ) {
    id
    content
    original_language
  }
}`
      },
      projectsDelete: {
        type: "mutation",
        name: "Delete Project",
        description: "Deletes a project by ID",
        variables: {
          projectId: "ID of the project to delete"
        },
        query: `mutation DeleteProject($projectId: String!) {
  deleteFromProject(where: { id: { eq: $projectId } }) {
    id
    title_id
  }
}`
      },
      projectsGetById: {
        type: "query",
        name: "Get Project by ID",
        description: "Retrieves a single project by its ID",
        variables: {
          projectId: "ID of the project to retrieve"
        },
        query: `query GetProject($projectId: String!) {
  project(where: { id: { eq: $projectId } }) {
    id
    created_at
    updated_at
    title_id
    description_id
    title {
      content
      original_language
      translations {
        content
        language_code
      }
    }
    description {
      content
      original_language
      translations {
        content
        language_code
      }
    }
    institutionsCount
    institutions {
      id
      name {
        content
      }
    }
    projectLanguages {
      language_code
      is_default
      language {
        code
        name
      }
    }
  }
}`
      },
      projectsList: {
        type: "query",
        name: "List Projects",
        description: "Retrieves all projects with their institutions and languages",
        query: `{
  project {
    id
    created_at
    updated_at
    title_id
    description_id
    title {
      content
      original_language
    }
    description {
      content
      original_language
    }
    institutionsCount
    institutions {
      id
      name {
        content
      }
    }
    projectLanguages {
      language_code
      is_default
      language {
        code
        name
      }
    }
  }
}`
      },
      projectAddLanguage: {
        type: "mutation",
        name: "Add Language to Project",
        description: "Adds a language to a project",
        variables: {
          projectId: "ID of the project",
          languageCode: "Code of the language to add",
          isDefault: "Whether this is the default language (0 or 1)"
        },
        query: `mutation AddProjectLanguage($projectId: String!, $languageCode: String!, $isDefault: Int!) {
  insertIntoProject_languages(values: [{
    project_id: $projectId,
    language_code: $languageCode,
    is_default: $isDefault
  }]) {
    project_id
    language_code
    is_default
  }
}`
      },
      projectRemoveLanguage: {
        type: "mutation",
        name: "Remove Language from Project",
        description: "Removes a language from a project",
        variables: {
          projectId: "ID of the project",
          languageCode: "Code of the language to remove"
        },
        query: `mutation RemoveProjectLanguage($projectId: String!, $languageCode: String!) {
  deleteFromProject_languages(
    where: { 
      project_id: { eq: $projectId },
      language_code: { eq: $languageCode }
    }
  ) {
    project_id
    language_code
  }
}`
      },
      projectSetDefaultLanguage: {
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
    where: { 
      project_id: { eq: $projectId },
      language_code: { eq: $languageCode }
    }
  ) {
    project_id
    language_code
    is_default
  }
}`
      },
      projectsListWithCounts: {
        type: "query",
        name: "List projects (with counts)",
        description: "Retrieves all the projects with their institutions and objects count",
        query: `{
  projectsList {
    id
    created_at
    updated_at
    title {
      content
      original_language
    }
    description {
      content
      original_language
    }
    institutionsCount
    objectsCount
  }
}`
      }
    }
  },
  institutions: {
    name: "Institutions",
    operations: {
      institutionsGetById: {
        type: "query",
        name: "Get Institution by ID",
        description: "Retrieves a single institution by its ID",
        variables: {
          projectId: "ID of the institution to retrieve"
        },
        query: `query GetInstitution($projectId: String!) {
  institutions(where: { id: { eq: $projectId } }) {
    id
    created_at
    updated_at
    name {
      content
      translations {
        content
        language_code
      }
    }
    description {
      content
      translations {
        content
        language_code
      }
    }
    project {
      id
      title {
        content
        translations {
          content
          language_code
        }
      }
      description {
        content
        translations {
          content
          language_code
        }
      }
    }
    country {
      content
      translations {
        content
        language_code
      }
    }
    location {
      content
      translations {
        content
        language_code
      }
    }
  }
}`
      },
      institutionsCreate: {
        type: "mutation",
        name: "Create Institution",
        description: "Creates a new institution linked to a project",
        variables: {
          projectId: "ID of the project to link the institution to",
          languageCode: "Language code for the initial text",
          institutionName: "Name of the institution",
          institutionDescription: "Description of the institution",
          country: "Country of the institution",
          location: "Location of the institution"
        },
        mutations: [
          {
            name: "createNameText",
            query: `mutation CreateInstitutionName($institutionName: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $institutionName,
    context: "institutions.name",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["institutionName", "languageCode"]
          },
          {
            name: "createDescriptionText",
            query: `mutation CreateInstitutionDescription($institutionDescription: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $institutionDescription,
    context: "institutions.description",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["institutionDescription", "languageCode"]
          },
          {
            name: "createCountryText",
            query: `mutation CreateInstitutionCountry($country: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $country,
    context: "institutions.country",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["country", "languageCode"]
          },
          {
            name: "createLocationText",
            query: `mutation CreateInstitutionLocation($location: String!, $languageCode: String!) {
  insertIntoTexts(values: [{
    content: $location,
    context: "institutions.location",
    original_language: $languageCode
  }]) {
    id
    content
  }
}`,
            useVariables: ["location", "languageCode"]
          },
          {
            name: "createInstitution",
            query: `mutation CreateInstitutionEntry($nameId: String!, $descriptionId: String!, $countryId: String!, $locationId: String!, $projectId: String!) {
  insertIntoInstitutions(values: [{
    name_id: $nameId,
    description_id: $descriptionId,
    country_id: $countryId,
    location_id: $locationId,
    project_id: $projectId
  }]) {
    id
    name_id
    description_id
    country_id
    location_id
    project_id
  }
}`,
            useVariables: ["projectId"],
            mapVariables: {
              nameId: { from: "createNameText", path: "insertIntoTexts.0.id" },
              descriptionId: { from: "createDescriptionText", path: "insertIntoTexts.0.id" },
              countryId: { from: "createCountryText", path: "insertIntoTexts.0.id" },
              locationId: { from: "createLocationText", path: "insertIntoTexts.0.id" }
            }
          }
        ],
        query: null
      },
      institutionsUpdate: {
        type: "mutation",
        name: "Update Institution",
        description: "Updates an existing institution by ID",
        variables: {
          institutionId: "ID of the institution to update",
          name: "New name content",
          description: "New description content",
          country: "New country content",
          location: "New location content"
        },
        query: `mutation UpdateInstitution($institutionId: String!, $name: String!, $description: String!, $country: String!, $location: String!) {
  # Update the name
  updateName: updateTexts(
    set: { content: $name }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
  # Update the description
  updateDescription: updateTexts(
    set: { content: $description }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
  # Update the country
  updateCountry: updateTexts(
    set: { content: $country }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
  # Update the location
  updateLocation: updateTexts(
    set: { content: $location }
    where: { id: { eq: $institutionId } }
  ) {
    id
    content
    original_language
  }
}`
      },
      institutionsDelete: {
        type: "mutation",
        name: "Delete Institution",
        description: "Deletes an institution by ID",
        variables: {
          institutionId: "ID of the institution to delete"
        },
        query: `mutation DeleteInstitution($institutionId: String!) {
  deleteFromInstitutions(where: { id: { eq: $institutionId } }) {
    id
    name_id
    description_id
    country_id
    location_id
  }
}`
      },
      institutionsList: {
        type: "query",
        name: "List Institutions",
        description: "Retrieves all institutions",
        query: `{
  institutions {
    id
    name {
      content
      translations {
        content
        language_code
      }
    }
    description {
      content
      translations {
        content
        language_code
      }
    }
    project {
      id
      title {
        content
        translations {
          content
          language_code
        }
      }
      description {
        content
        translations {
          content
          language_code
        }
      }
    }
    country {
      content
      translations {
        content
        language_code
      }
    }
    location {
      content
      translations {
        content
        language_code
      }
    }
  }
}`
      },
      institutionsListWithCounts: {
        type: "query",
        name: "List Institutions (with counts)",
        description: "Retrieves all institutions with their counts",
        query: `{
          institutionsList {
            id
            created_at
            updated_at
            project_id
            name {
              content
            }
            description {
              content
            }
            location {
              content
            }
            country {
              content
            }
            assetsCount
            datasourcesCount
            objectsCount
          }
        }`
      },
      institutionsGetByIdWithCounts: {
        type: "query",
        name: "Get Institution By ID (with counts)",
        description: "Retrieves a single institution by its ID with all details including counts",
        query: `query GetInstitution($institutionId: String!) {
          institutionById(institution_id: $institutionId) {
            id
            created_at
            updated_at
            project_id
            name {
              content
              original_language
              translations {
                language_code
                content
              }
            }
            description {
              content
              translations {
                language_code
                content
              }
            }
            location {
              content
              translations {
                language_code
                content
              }
            }
            country {
              content
              translations {
                language_code
                content
              }
            }
            links {
              content
              translations {
                language_code
                content
              }
            }
            assetsCount
            datasourcesCount
            objectsCount
          }
        }`,
        variables: {
          institutionId: "your-institution-id-here"
        }
      }
    }
  },
  translations: {
    name: "Translations",
    operations: {
      translationsCreate: {
        type: "mutation",
        name: "Create Translation",
        description: "Creates a translation for a specific text",
        variables: {
          textId: "ID of the text to translate",
          languageCode: "Language code for the translation",
          content: "Translated content"
        },
        query: `mutation CreateTranslation($textId: String!, $languageCode: String!, $content: String!) {
  insertIntoTranslations(values: [{
    text_id: $textId,
    language_code: $languageCode,
    content: $content
  }]) {
    id
    content
    language_code
    text_id
  }
}`
      },
      translationsUpdate: {
        type: "mutation",
        name: "Update Translation",
        description: "Updates an existing translation",
        variables: {
          id: "ID of the translation to update",
          content: "New translated content"
        },
        query: `mutation UpdateTranslation($id: String!, $content: String!) {
  updateTranslations(
    set: { content: $content }
    where: { id: { eq: $id } }
  ) {
    id
    content
    language_code
    text_id
  }
}`
      }
    }
  },
  interface_translations: {
    name: "Interface Translations",
    operations: {
      interfaceTranslationsList: {
        type: "query",
        name: "List Interface Translations",
        description: "Retrieves all interface translations",
        query: `{
  interface_translations {
    id
    locale
    namespace
    key
    value
  }
}`
      },
      interfaceTranslationsGetByLocale: {
        type: "query",
        name: "Get Interface Translations By Locale",
        description: "Retrieves interface translations for a specific locale",
        variables: {
          locale: "Language code for the translations"
        },
        query: `query GetInterfaceTranslations($locale: String!) {
  interface_translations(where: { locale: { eq: $locale } }) {
    id
    namespace
    key
    value
  }
}`
      },
      interfaceTranslationsCreate: {
        type: "mutation",
        name: "Create Interface Translation",
        description: "Creates a new interface translation",
        variables: {
          locale: "Language code for the translation",
          namespace: "Namespace for grouping translations",
          key: "Translation key",
          value: "Translated content"
        },
        query: `mutation CreateInterfaceTranslation($locale: String!, $namespace: String!, $key: String!, $value: String!) {
  insertIntoInterface_translations(values: [{
    locale: $locale,
    namespace: $namespace,
    key: $key,
    value: $value
  }]) {
    id
    locale
    namespace
    key
    value
  }
}`
      },
      interfaceTranslationsUpdate: {
        type: "mutation",
        name: "Update Interface Translation",
        description: "Updates an existing interface translation",
        variables: {
          id: "ID of the translation to update",
          value: "New translated content"
        },
        query: `mutation UpdateInterfaceTranslation($id: String!, $value: String!) {
  updateInterface_translations(
    set: { value: $value }
    where: { id: { eq: $id } }
  ) {
    id
    value
  }
}`
      },
      interfaceTranslationsDelete: {
        type: "mutation",
        name: "Delete Interface Translation",
        description: "Deletes an interface translation",
        variables: {
          id: "ID of the translation to delete"
        },
        query: `mutation DeleteInterfaceTranslation($id: String!) {
  deleteFromInterface_translations(where: { id: { eq: $id } }) {
    id
  }
}`
      },
      interfaceTranslationsImport: {
        type: "mutation",
        name: "Import Interface Translations",
        description: "Imports multiple interface translations at once",
        variables: {
          translations: "Array of translations to import"
        },
        query: `mutation ImportInterfaceTranslations($translations: [interface_translationsInsertInput!]!) {
  insertIntoInterface_translations(values: $translations) {
    id
    locale
    namespace
    key
    value
  }
}`
      }
    }
  },
  schema: {
    name: "GraphQL Schema",
    operations: [
      {
        type: "schema",
        name: "Introspection Query",
        description: "Retrieves the GraphQL schema structure",
        query: `{
  __schema {
    types {
      name
      fields {
        name
        type {
          name
          kind
        }
      }
    }
    mutationType {
      fields {
        name
        args {
          name
          type {
            name
            kind
          }
        }
      }
    }
  }
}`
      }
    ]
  },
  logs: {
    name: "Logs",
    operations: {
      logsList: {
        type: "query",
        name: "List Logs",
        description: "Retrieves logs with pagination and filtering",
        variables: {
          page: "Page number for pagination (offset)",
          pageSize: "Number of logs per page (limit)",
          level: "Filter by log level (error, warn, info, debug)",
          action: "Filter by action",
          fromDate: "Filter by date range (start timestamp)",
          toDate: "Filter by date range (end timestamp)",
          search: "Search in log messages"
        },
        query: `query ListLogs($page: Int!, $pageSize: Int!, $level: String, $action: String, $fromDate: String, $toDate: String, $search: String) {
  logs(
    limit: $pageSize
    offset: $page
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
      message: { like: $search }
    }
  ) {
    id
    created_at
    level
    action
    message
  }
  
  # Get total count for pagination
  totalLogs: logs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
      message: { like: $search }
    }
  ) {
    id
  }
}`
      },
      logsCreate: {
        type: "mutation",
        name: "Create Log",
        description: "Creates a new log entry",
        variables: {
          level: "Log level (error, warn, info, debug)",
          action: "The action that triggered the log",
          message: "Log message content"
        },
        query: `mutation CreateLog($level: String!, $action: String!, $message: String!) {
  insertIntoLogs(values: [{
    level: $level,
    action: $action,
    message: $message
  }]) {
    id
    created_at
    level
    action
    message
  }
}`
      },
      logsDelete: {
        type: "mutation",
        name: "Delete Log",
        description: "Deletes a log entry by ID",
        variables: {
          id: "ID of the log to delete"
        },
        query: `mutation DeleteLog($id: String!) {
  deleteFromLogs(where: { id: { eq: $id } }) {
    id
  }
}`
      },
      logsClear: {
        type: "mutation",
        name: "Clear Logs",
        description: "Clears logs based on filters",
        variables: {
          level: "Filter by log level",
          action: "Filter by action",
          fromDate: "Filter by date range (start timestamp)",
          toDate: "Filter by date range (end timestamp)"
        },
        query: `mutation ClearLogs($level: String, $action: String, $fromDate: String, $toDate: String) {
  deleteFromLogs(
    where: {
      level: { eq: $level }
      action: { eq: $action }
      created_at: { gte: $fromDate, lte: $toDate }
    }
  ) {
    id
  }
}`
      }
    }
  }
}; 